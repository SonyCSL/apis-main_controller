#!/usr/bin/env python
import os, datetime, time, logging.config, urllib2, pytz
import dataCollector

SCHEDULE_DIR = './schedule'
OPERATION_SOFT_STOP = 'softStop'
OPERATION_SHUT_DOWN = 'shutDown'
SEPARATOR = '-'

schedule = {}

logger = logging.getLogger(__name__)

####

def writeFile(path, value):
    with open(path, 'w') as f:
        f.write(value)
def readFile(path):
    with open(path, 'r') as f:
        return f.read().strip()
def deleteFile(path):
    try:
        os.remove(path)
    except OSError:
        if os.path.exists(path):
            raise
def ensureDir(path):
    try:
        os.makedirs(path)
    except OSError:
        if not os.path.isdir(path):
            raise

####

def fromIsoformat(value):
    result = datetime.datetime.strptime(value[:19], '%Y-%m-%dT%H:%M:%S')
    pos = value.rfind('+', 19)
    if pos < 0:
        pos = value.rfind('-', 19)
    if 0 < pos:
        if value[pos] == '+':
            result -= datetime.timedelta(hours = int(value[pos+1:pos+3]), minutes = int(value[pos+4:]))
        else:
            result += datetime.timedelta(hours = int(value[pos+1:pos+3]), minutes = int(value[pos+4:]))
    return pytz.utc.localize(result)

def writeDatetime(path, value):
    try:
        if isinstance(value, datetime.datetime):
            writeFile(path, value.isoformat())
        else:
            deleteFile(path)
    except Exception as e:
        logger.error(path + ' : ' + str(e))

def readDatetime(path):
    try:
        return fromIsoformat(readFile(path))
    except Exception as e:
        logger.error(path + ' : ' + str(e))

####

def setSchedule(unitId, operation, value):
    if unitId is None or len(unitId) == 0:
        # global
        path = SCHEDULE_DIR + '/' + SEPARATOR + operation
    else:
        # local
        path = SCHEDULE_DIR + '/' + unitId + SEPARATOR + operation
    writeDatetime(path, value)

def deleteScheduleIfNeed(unitId, operation):
    if unitId is None or len(unitId) == 0:
        # global
        path = SCHEDULE_DIR + '/' + SEPARATOR + operation
    else:
        # local
        path = SCHEDULE_DIR + '/' + unitId + SEPARATOR + operation
    dt = readDatetime(path)
    if dt is not None:
        now = datetime.datetime.now(pytz.utc)
        if dt <= now:
            deleteFile(path)

####

def sendToBudo(url):
    try:
        logger.debug('url : ' + url)
        res = urllib2.urlopen(url, timeout = 1).read()
        logger.debug('res : ' + res)
        return res
    except Exception as e:
        logger.error(e)

def doSoftStop(budoUrl, unitId):
    uri = None
    if unitId is None or len(unitId) == 0:
        # global
        if 0 < len(dataCollector.cache):
            value = dataCollector.cache[dataCollector.cache.keys()[0]]['apis']['operation_mode']['global']
            if 'autonomous' == value:
                uri = budoUrl + '/setOperationMode?value=heteronomous'
    else:
        # local
        if unitId in dataCollector.cache:
            value = dataCollector.cache[unitId]['apis']['operation_mode']['local']
            if 'autonomous' == value or None == value:
                uri = budoUrl + '/setOperationMode?value=heteronomous&unitId=' + unitId
    if uri is not None:
        return sendToBudo(uri)

def doShutDown(budoUrl, unitId):
    logger.warn(OPERATION_SHUT_DOWN + ' operation not yet implemented')

####

def execAll(budoUrl):
    now = datetime.datetime.now(pytz.utc)
    for uid, ops in schedule.items():
        for op, dt in ops.items():
            if dt <= now:
                if OPERATION_SOFT_STOP == op:
                    doSoftStop(budoUrl, uid)
                elif OPERATION_SHUT_DOWN == op:
                    doShutDown(budoUrl, uid)
                else:
                    logger.error('unnown operation : ' + uid + ' / ' + op + ' / ' + dt.isoformat())

def readAll():
    global schedule
    result = {}
    ensureDir(SCHEDULE_DIR)
    for f in os.listdir(SCHEDULE_DIR):
        p = SCHEDULE_DIR + '/' + f
        if os.path.isfile(p):
            pos = f.rfind(SEPARATOR)
            if 0 <= pos:
                dt = readDatetime(p)
                if dt is not None:
                    uid = f[:pos]
                    op = f[pos+1:]
                    if uid not in result:
                        result[uid] = {op: dt}
                    else:
                        result[uid][op] = dt
            else:
                logger.warn(p + ' : unknown file')
        else:
            logger.warn(p + ' : not a regular file')
    schedule = result

def startScheduler(interval, budoUrl):
    while True:
        try:
            readAll()
            execAll(budoUrl)
        except:
            import traceback
            traceback.print_exc()
        time.sleep(interval)

####

if __name__ == "__main__":
    logging.config.fileConfig("config/logger.conf", disable_existing_loggers = 0)
    logger = logging.getLogger(__name__)
    startScheduler(5, 'http://localhost:43830')
