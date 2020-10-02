#!/usr/bin/env python
import socket, json, time, threading, urllib2, logging.config, sys
from tools import helper
from time import mktime
import dataLogger
#from uuid import getnode as get_mac


MCAST_GRP = '224.1.1.1'
MCAST_PORT_BEAGLE_ALIVE = 5007
MCAST_PORT_DATACOLL_ALIVE = 5008
UDP_PORT = 5010

cache={}

participating=False
logger = logging.getLogger(__name__)
cpath= '../../.oes'
emul_getlog= "/get/log"
emul_url_getlog="to be overwritten in startDataCollector"

area=None
logToDB=False
logEmulatorToDB=False

def periodicAlive(interval):
    
    strMsg = makeAliveMsg()
    
    if logToDB and area:
        logger.info("logging data to DB for area "+area)
    else : 
        logger.info("not logging data to DB")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
    
    #send periodically (inifite loop)
    i=0
    while True:
        #logger.debug( "sending alive multicast message"+json.dumps(msg))
        sock.sendto(strMsg, (MCAST_GRP, MCAST_PORT_DATACOLL_ALIVE))
        time.sleep(interval)
        removeOldOesunits()

        #logging to db
        if logToDB and area:
            i=i+1
            if area!="faculty" or i==3: #in faculty houses only save to db every 3*5s
                dataLogger.dbLogNow(area, json.dumps(cache))        
                i=0
            

   
def makeAliveMsg():
    msg=helper.getInfo()    
    #overwrite some file infos
    msg["display"]="dataCollector"
    msg["id"]="dataColl"
    msg["port"]=UDP_PORT
    msg["on"]=participating
    
    if "area" in msg :
        global area
        area=msg['area']

    return str(json.dumps(msg))
        
def dataCollector() :

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.bind(("", UDP_PORT))
    logger.debug( "waiting on port:"+str( UDP_PORT))
    while 1:
        #data = s.recvfrom(2048)
        try:
            data, addr = s.recvfrom(2048)
            #print data
            #print addr[0]
            #seems like we need to convert twice: string -> unicode -> dict
            jsondata =json.loads(json.loads(data),  object_hook=helper.convert)
            if jsondata["oesunit"]["id"] not in cache:
                logger.info("New unit discovered : "+ jsondata["oesunit"]["id"])
            cache[jsondata["oesunit"]["id"]] = jsondata
        except TypeError:
            logger.error( "Datacollector could not decode json "+ str(data))
        except:
            logger.error("Unexpected error:"+ str(sys.exc_info()[0]))
        

def removeOldOesunits():
    todelete=[]
    
    for oesunit in cache:
        now=time.time()
        last = mktime(time.strptime(cache[oesunit]["time"], "%Y/%m/%d-%H:%M:%S"))
        if now-last > 20 :
            logger.warn("deleting oesunit from cache because no reply to datacollector for "+str(now-last)+" seconds. Oesid: "+oesunit)
            todelete.append(oesunit)
    #if there is any unit that should be deleted
    if todelete :
        for i in todelete:
                del cache[i]
        
def forceCacheUpdate(emulator):
    try: 
        global cache
        logger.warn("Clear cache and make single call to dataCollector")
        cache.clear()
        if emulator :
            logger.warn("forced cache update "+emul_url_getlog)
            jsonrsp = urllib2.urlopen(emul_url_getlog, timeout=2).read()
            jsonout = json.loads(jsonrsp, object_hook=helper.convert)  
            for i in jsonout :
                cache[jsonout[i]["oesunit"]["id"]] =jsonout[i]
            logger.warn(cache);
        else :
            strMsg = makeAliveMsg()
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
            sock.sendto(strMsg, (MCAST_GRP, MCAST_PORT_DATACOLL_ALIVE))
    except urllib2.URLError, e:
        logging.error(e.reason)
    
def emulatedDataCollector(interval):
    i=0
    while 1:
        # log to db every 10 requests if logEmulatorToDB=True 
        #(only to be used in faculty houses running on budo v1.0)
        if logEmulatorToDB and i>=10 :
            callToEmulator(True)
            i=0
        else:
            callToEmulator(False)
        time.sleep(interval)
        i+=1

def callToEmulator(logToDB=False):
    global cache
    try: 
        jsonrsp = urllib2.urlopen(emul_url_getlog, timeout=2).read()
        jsonout = json.loads(jsonrsp, object_hook=helper.convert)  
        if len(jsonout)==0:
            logging.error("empty json received "+str(jsonout))
        else:
            cache.clear()
            now="empty"
            for i in jsonout :
                cache[jsonout[i]["oesunit"]["id"]] =jsonout[i]
                now  = jsonout[i]["time"]
            logging.debug("emulDataCollectorCall: " +now)
        if logToDB :
            #logging.debug("logging to db")
            dataLogger.dbLogNow("faculty", json.dumps(cache))
        #else :
        #    logging.debug("not logging to db")
    except ValueError,e :
        logging.error(" json could not be decoded+ "+e.reason)
        logging.error(jsonout)
    except socket.timeout:
        logging.error("Socket timeout for "+ emul_url_getlog)
    except urllib2.URLError, e:
        logging.error("urllib2.urlerror  in data collector"+str(e.reason))
    except :
        logging.exception('')
        logging.error("unkown error in data collector")


def startDataCollector(interval, emulator, emul_url):    
    global emul_url_getlog
    emul_url_getlog=emul_url+emul_getlog
    logger.info("starting datacollector "+emul_url_getlog)
    if emulator : 
        logger.info("starting emulated datacollector")
        emulatedDataCollector(interval)
    else :
        logger.info("starting datacollector")
        #sending alive messages to trigger log data
        t = threading.Thread(target=periodicAlive, args=(interval,), name="alive-messages")
        t.daemon = True
        t.start()
        
        #sleep for one second => there is a strange global import lock on strptime hold by another thread. sleeping for 1s seems to solve it
        #time.sleep(10)
        #listen to responses
        dataCollector()
    
# if no other main is around use this one
if __name__ == "__main__":
    logging.config.fileConfig("config/logger.conf",disable_existing_loggers=0)
    logger = logging.getLogger(__name__)
    startDataCollector(5, False)
