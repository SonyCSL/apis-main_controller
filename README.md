# apis-main_controller

## Introduction
Main Controller is a web app for real-time display of the status of each node on which apis-main is installed, and the energy sharing status. The information required for display is obtained via the Web API provided by apis-web. It can also change the energy sharing operation mode of the cluster for operation and debugging, and control the DC/DC Converter of each node individually to implement energy sharing. 

Refer to the [apis-mmain_controller_specification](#anchor1) for more details

![main_controller](https://user-images.githubusercontent.com/71874910/94902724-9b986b00-04d3-11eb-8103-e01691331ec1.PNG)

![a-is-main_controller1](https://user-images.githubusercontent.com/71874910/94903046-25e0cf00-04d4-11eb-83b4-dac12ae0daf9.PNG)

## Installation
Here is how to install apis-main_controller individually.  

```bash
$ git clone https://github.com/SonyCSL/apis-main_controller.git
$ cd apis-main_controller
$ python3 -m venv venv
$ . venv/bin/activate
$ pip install --upgrade pip
$ pip install -r requirements.txt
$ deactivate
```

## Running
Here is how to run apis-main_controller individually.  

```bash
$ cd apis-main_controller
$ . venv/bin/activate
$ python3 startMain.py
```
Go to "0.0.0.0:4382/" in Web browser.

## Stopping
Here is how to stop apis-main_controller individually.  

```bash
$ bash stop.sh
$ deactivate
```
<a id="anchor1"></a>
## Documentation
&emsp;[apis-mian_controller_specification(JP)](https://github.com/SonyCSL/apis-main_controller/blob/master/doc/jp/apis-main-controller_specification.md)



## License
&emsp;[Apache License Version 2.0](https://github.com/oes-github/apis-main-controller/blob/master/LICENSE)


## Notice
&emsp;[Notice](https://github.com/oes-github/apis-main-controller/blob/master/NOTICE.md)
