#!/usr/bin/env python

import time, requests, logging.config, sys

logger = logging.getLogger(__name__)
dburl='http://example.com/oes/'

#when called from main thread
def dbLogNow(area,jsonstring):
    #json should be string
      
    posturl=dburl+'push-'+area+ '.cgi'
    logger.debug(posturl)

    try:
        #logger.debug(jsonstring)
        p = requests.post (posturl, data = jsonstring, timeout=1) 
        #logger.debug("logging done "+p.text)
    except:
        logger.error(sys.exc_info()[0])

#independent process
def startLogger(interval):
    while True : 
        r = requests.get('http://localhost:4382/get/log') 

        logger.debug(r.text) 
        p = requests.post (dburl+'push-emulator_old.cgi', data = r.text) 
        logger.debug(p.text) 
        time.sleep(interval)


    
if __name__ == "__main__":
    logging.config.fileConfig("config/logger.conf",disable_existing_loggers=0)
    logger = logging.getLogger(__name__)
    startLogger(5)
