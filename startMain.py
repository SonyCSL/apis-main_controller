#!/usr/bin/env python
import socket, sys, requests, urllib2, json, time, _strptime, threading, getopt, subprocess,  logging.config
from bottle import route, run,template, static_file, request, response


import dataCollector, scheduler
from tools import helper



b_host = "0.0.0.0"
b_port = 4382

emul_port= 4390
budo_port = 4383

emulator = False

apis = True
apis_host = "localhost"
apis_emul_port=43900
apis_budo_port=43830

apis_emul_url="http://"+apis_host+":"+str(apis_emul_port)
apis_budo_url="http://"+apis_host+":"+str(apis_budo_port)

ups_set_url = ":8080/1/ups1/operation/mode"
set_url = ":4380/remote/set?"
url = {"dcdc": "4380/remote/get",
       "meter": "4380/inquiry/09",
       "emu":  "8080/1/log/data"}

emul_url= "http://localhost:"+str(emul_port)
budo_url= "http://localhost:"+str(budo_port)

datacollectorinterval=5
schedulerInterval=5


def _jsonResponse(obj):
	if len(request.query.callback) > 0:
		return request.query.callback + '(' + json.dumps(obj) + ')'
	else:
		response.content_type = 'application/json'
		return json.dumps(obj)


@route('/')
def index():
    oes_tuples=[]

    if apis:
        try:
            jsonrsp = urllib2.urlopen(apis_budo_url+'/unitIds', timeout=1).read()
            out = json.loads(jsonrsp)
            for oesid in sorted(out) :
                if oesid in dataCollector.cache :
                    row = [oesid, dataCollector.cache[oesid]['oesunit']['ip'], dataCollector.cache[oesid]['oesunit']['display']]
                else :
                    row = [oesid, '--', '--']
                oes_tuples.append(row)
        except Exception, e:
            out = {'error' : str(e)}
            logger.warn(json.dumps(out))
    else :
        for oesid, ajson in sorted(dataCollector.cache.items()) :
            row = [oesid, ajson["oesunit"]["ip"], ajson["oesunit"]["display"]]
            oes_tuples.append(row)
        
    #ipaddr = "1.2.3.4"#socket.gethostbyname(socket.gethostname())
    return template('main',
                    admintext="admin",
                    title="Energy Exchange in "+area,
                    #ip= ipaddr,
                    oes_tuples=sorted(oes_tuples),
                    emulator=emulator
                    )

@route('/flushCache')
def flushCache():
    dataCollector.forceCacheUpdate(emulator or apis)
    return "Cache has been flushed."

@route('/upsMode/<upsmode>')
def upsMode(upsmode):
    try: 
        mode = int(upsmode)
        if mode>=0 and mode<=7 :
            logger.info("setting ups mode of all units to "+str(mode))
            out_json={}
            for oesid in dataCollector.cache :
                ip = dataCollector.cache[oesid]['oesunit']['ip']
                url = "http://" + ip + ups_set_url
                payload = {"operation_mode" : mode }
                logger.info("sending request to : "+url)
                logger.info("data : "+ str(payload))
                headers = {'Content-Type':'application/json'}
                r = requests.put(url, data=json.dumps(payload), headers=headers)#urllib2.Request(url, data)
                logger.info(" response after setting ups mode "+str(r.json()))
                out_json[oesid] = r.json()
            return json.dumps(out_json)
        else:
            raise ValueError("ups value not allowed "+str(mode))
    except ValueError:
        return json.dumps({"Error": "Mode must be allowed int"})

    
@route('/stopAll')
def stopAll():
    out = json.loads(checkBudo())
    logger.warn("manual stop of all beaglebones requested"+str(out))
    
    #if budo is running and has no error and its status is active, stop first via budoS
    if out and 'error' not in out and 'active' in out and out['active'] :
        setbudo("stop")
        logger.info("stopping done by budo")
    #if budo is not running or already stopped
    else: 
        logger.info("stoppingall units by main controller")
        threadList=[]
        for oesid in dataCollector.cache :
            #no matter what error happens, continue stopping all units
            logger.info('stopping beaglebone '+oesid)
            if emulator:
                url = emul_url+"/set/dcdc/"+oesid+"?mode=0x0000&dvg=350&dig=2"
                logger.info("stopping dcdc on emulator  "+url)
                dataCollector.cache[oesid]["dcdc"] = directBeagleCall(url)
            else:
                t = threading.Thread(target=sendRequest, name="stopasynch", args=(oesid,"mode=0x0000&dvg=350&dig=2",))
                t.start()
                threadList.append(t)

        for t in threadList:
            t.join()
    return json.dumps({"stopAll": 'done.'})
        

@route('/get/globalmode')
def checkBudo():
    try: 
        logger.debug("Checking if budo responds")
        if apis :
            jsonrsp = urllib2.urlopen(apis_budo_url+"/getStatus", timeout=1).read()
        else :
            jsonrsp = urllib2.urlopen(budo_url+"/getStatus", timeout=1).read()
        out= json.loads(jsonrsp, object_hook=helper.convert)  
 
    except socket.timeout, e:
        out={"error": 'SocketTimeout'}
        logger.warn(json.dumps(out))
    except urllib2.HTTPError, e:
        out={"error": 'HTTPError'} 
        logger.warn(json.dumps(out))
    except urllib2.URLError, e:
        out={"error": 'URLError'}
        logger.warn(json.dumps(out))
    return _jsonResponse(out)    

@route('/set/budo/<mode>')
def setbudo(mode):
    response.content_type = 'application/json'
    callback = request.query.callback
    try:
        logger.info("budo request "+mode)
        response.content_type = 'application/json'
        #mode should be either "active" or "stop"
        if apis :
            url=apis_budo_url+"/"+mode
        else :
            url=budo_url+"/"+mode
        logger.info("Setting budo to mode "+mode+" url: "+url)
        jsonrsp = urllib2.urlopen(url, timeout=10).read()
        out= json.loads(jsonrsp, object_hook=helper.convert)  


    except :
        e = sys.exc_info()[0]
        logger.error("something did not work with mode setting"+str(e))
        out= {"error":" could not set mode "+mode} 
    if len(callback)>0:
        return callback +'('+json.dumps(out)+')'
    return json.dumps(out)


@route('/get/dealsInfo')
def getBudoDeals():
    try: 
        if apis :
            jsonrsp = urllib2.urlopen(apis_budo_url+"/deals", timeout=1).read()
        else: 
            jsonrsp = urllib2.urlopen(budo_url+"/deals", timeout=1).read()
        out= json.loads(jsonrsp, object_hook=helper.convert)  

    except socket.timeout, e:
        out={"error": 'SocketTimeout when trying to get Budo status'}
        logger.warn(json.dumps(out))
    except urllib2.HTTPError, e:
        out={"error": 'HTTPError =  when trying to get Budo status'}
        logger.warn(json.dumps(out))
    except urllib2.URLError, e:
        out={"error": 'URLError = when trying to get Budo status'}
        logger.warn(json.dumps(out))
    except Exception, e:
        out={"error": 'Unknown Error'+str(e)}
        logger.warn(json.dumps(out))
    return _jsonResponse(out)


@route('/setOperationMode')
def setOperationMode():
    if apis:
        try:
            if apis :
                jsonrsp = urllib2.urlopen(apis_budo_url + '/setOperationMode?' + request.query_string, timeout = 1).read()
                out = json.loads(jsonrsp, object_hook = helper.convert)
                scheduler.deleteScheduleIfNeed(request.query.unitId, 'softStop')
            else :
                out = {'error' : 'Cannot set operationMode, no APIS here.'}
        except Exception, e:
            out = {'error' : str(e)}
            logger.warn(json.dumps(out))
    return json.dumps(out)

@route('/shutDown')
def shutDown():
    if apis:
        try:
            if apis :
                jsonrsp = urllib2.urlopen(apis_budo_url + '/shutdown?' + request.query_string, timeout = 1).read()
                out = json.loads(jsonrsp, object_hook = helper.convert)
                scheduler.deleteScheduleIfNeed(request.query.unitId, 'shutDown')
            else :
                out = {'error' : 'Cannot shutDown, no APIS here.'}
        except Exception, e:
            out = {'error' : str(e)}
            logger.warn(json.dumps(out))
    return json.dumps(out)

@route('/schedules')
def schedules():
    if apis:
        response.content_type = 'application/json'
        callback = request.query.callback
        out = scheduler.schedule
        if 0 < len(callback):
            return callback + '(' + json.dumps(out, default=helper.convert) + ')'
        else:
            return json.dumps(out, default=helper.convert)
@route('/setSchedule')
def setSchedule():
    unitId = request.query.unitId
    operation = request.query.operation
    value = None
    if 0 < len(request.query.value):
        value = scheduler.fromIsoformat(request.query.value)
    scheduler.setSchedule(unitId, operation, value)

    
@route('/get/logInfo')
def getLog():
    return _jsonResponse(dataCollector.cache)


@route('/get/unit/<oesid>')
def getRemote(oesid):
    return makeRequest(request, oesid, "all")
    

@route('/get/dcdc/<oesid>')
def getRemoteDcdc(oesid):
    return makeRequest(request, oesid, "dcdc")
    

@route('/get/meter/<oesid>')
def getRemoteMeter(oesid):
    return makeRequest(request, oesid, "meter")

@route('/get/emu/<oesid>')
def getRemoteEmu(oesid):
    return makeRequest(request, oesid, "emu")

@route('/get/oesunit/<oesid>')
def getRemoteOesunit(oesid):
    return makeRequest(request, oesid, "oesunit")

# write commands -> synchronous call to bealgebone
@route('/set/dcdc/<oesid>', method='GET')
def setDCDCRequest(oesid):
    response.content_type = 'application/json'
    callback = request.query.callback
    query = request.query_string
    if "&callback" in query:
        position = query.find("&callback")
        query = query[:position]
    out=sendRequest(oesid, query)

    #logger.debug(out)
    if len(callback)>0:
        return callback +'('+json.dumps(out)+')'
    return json.dumps(out)

    
@route('/ipv4')
def test():
    out = subprocess.check_output(['hostname', '-I']).split()
    return out[0]


#####
# resources
#####
      
@route('/js/<filename>')
def js_static(filename):
    return static_file(filename, root='./js')

@route('/img/<filename>')
def img_static(filename):
    return static_file(filename, root='./img')
@route('/css/images/<filename>')
def img_static(filename):
    return static_file(filename, root='./img')

@route('/css/<filename>')
def img_static_css(filename):
    return static_file(filename, root='./css')

    
#####
# update values from various beaglebones
#####        
def updateValues():
    for oesid in dataCollector.cache.keys():
        updateValue(oesid, "all")
        
            
def updateValue(oesid, name):
    try :
        if(name=="oesunit"):
            raise Exception("Oesunit direct call is not implemented")
        elif(name=="all"):
            dataCollector.cache[oesid]["dcdc"] = directBeagleCall("http://" + dataCollector.cache[oesid]['oesunit']['ip'] + ":" + url["dcdc"])
            dataCollector.cache[oesid]["emu"] = directBeagleCall("http://" + dataCollector.cache[oesid]['oesunit']['ip'] + ":" + url["emu"])
            #jsonrsp["received"]= time.strftime("%Y/%m/%d-%H:%M:%S")
        elif(name=="meter"):
            dataCollector.cache[oesid]["dcdc"]["meter"] = directBeagleCall("http://" + dataCollector.cache[oesid]['oesunit']['ip'] + ":" + url[name])
        else:
            dataCollector.cache[oesid][name] = directBeagleCall("http://" + dataCollector.cache[oesid]['oesunit']['ip'] + ":" + url[name])
        dataCollector.cache[oesid]["time"]=time.strftime("%Y/%m/%d-%H:%M:%S")    

    except socket.timeout, e:
        logger.error( 'SocketTimeout' + " for update on " +name+ " of " + oesid)
    except urllib2.HTTPError, e:
        logger.error( 'HTTPError = ' + str(e.code)+ " for update on " +name+ " of " + oesid)
    except urllib2.URLError, e:
        logger.error( 'URLError = ' + str(e.reason) + " for update on " +name+ " of " + oesid)
    #except Exception, e:
    #   logger.error( "Some unknown exception " +str(e) + " for update on " +name+ " of " + id)
             
def directBeagleCall(fullurl): 
    #print fullurl
    jsonrsp = urllib2.urlopen(fullurl, timeout=5).read()
    return json.loads(jsonrsp, object_hook=helper.convert)  



def setup(argv):
    #logging.getLogger("urllib3").setLevel(logging.WARN)
    #logging.getLogger("urllib3.poolmanager").setLevel(logging.WARN)
    #logging.getLogger("urllib3.connectionpool").setLevel(logging.WARN)
    #logging.getLogger("urllib3.response").setLevel(logging.WARN)
    #logging.getLogger("requests.auth").setLevel(logging.WARN)
    #logging.getLogger("requests.models").setLevel(logging.WARN)
    #logging.getLogger("requests").setLevel(logging.WARN)
    global area
    msg = helper.getFileInfo({}, '../../.oes')
    if "area" in msg :
        area=msg["area"]
    else:
        area="undefined"
        
    try:
        opts, args = getopt.getopt(argv,"d:e:",["db=","emul="])
    except getopt.GetoptError:
        logger.error('startvisual.py -d <db> -e <emul>')
        sys.exit(2)
    logger.debug('starting main_controller...')
    #set level higher for third party modules
    #logger.debug(logging.Logger.manager.loggerDict)

    for opt, arg in opts:
        if opt == '-h':
            logger.info('startvisual.py -db <db> -e <emulator>')
            sys.exit()
        if opt in ("-d", "--db"):
            if arg.lower() in ["false", "f"]:
                dataCollector.logToDB=False
                logger.debug(  "Not saving to DB")
        if opt in ("-e", "--emul"):
            if arg.lower() in ["true", "t"]:
                global emulator
                emulator = True
                area="emulator"
                
    global budoType
    if emulator :
        logger.debug("emul_url "+emul_url)
        logger.debug("budo_url "+budo_url)
    if apis :
        budoType = "apis"
        logger.debug("apis_emul_url "+apis_emul_url)
        logger.debug("apis_budo_url "+apis_budo_url)


def bottleServerThread():
    run(server="tornado", host=b_host, port=b_port, quiet=False, reloader=False)
    

def main(argv):
    setup(argv)
    #first time set values from beaglebones
    #updateValues()
    logger.info( "setup done")
    global datacollectorinterval
    if emulator:
        datacollectorinterval=1

    
    #start background thread to update values
    if apis :
        t = threading.Thread(target=dataCollector.startDataCollector, args=(datacollectorinterval,emulator or apis,apis_emul_url,), name="dataCollector")
    else :
        t = threading.Thread(target=dataCollector.startDataCollector, args=(datacollectorinterval,emulator or apis,emul_url,), name="dataCollector")
    t.daemon = True
    t.start()
    
    time.sleep(datacollectorinterval)

    if apis:
        t2 = threading.Thread(target = scheduler.startScheduler, args = (schedulerInterval, apis_budo_url,), name = 'scheduler')
        t2.daemon = True
        t2.start()
  
    #print dataCollector.cache
    #starting bottle server in main thread
    bottleServerThread()

    
if __name__ == "__main__":
    logging.config.fileConfig("config/logger.conf",disable_existing_loggers=False)
    logger = logging.getLogger(__name__)
    main(sys.argv[1:])
    
#git test 9
