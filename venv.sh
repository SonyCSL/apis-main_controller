#!/bin/sh

if type virtualenv-2 > /dev/null 2>&1 ; then
	VIRTUALENV=virtualenv-2
elif type virtualenv2 > /dev/null 2>&1 ; then
	VIRTUALENV=virtualenv2
elif type virtualenv > /dev/null 2>&1 ; then
	VIRTUALENV=virtualenv
else
	echo 'Your platform is not supported : no virtualenv'
	exit 1
fi

virtualenv --python=python2 venv
. venv/bin/activate
pip install -r requirements.txt
