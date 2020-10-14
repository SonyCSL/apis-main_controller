# apis-main_controller

## Introduction
apis-main-controllerはapis-mainがインストールされた各ノードの状態や電力融通の状況をリアルタイムに  
表示するWebアプリケーションである。表示に必要な情報はapis-webが提供するWeb APIを利用して取得する。  
また、運用及びDebug用としてクラスタの電力融通Operation Modeを変更したり、各ノードのDC/DC Converterを  
個別に制御し電力融通を実施させたりすることも可能である。  

![main_controller](https://user-images.githubusercontent.com/71874910/94902724-9b986b00-04d3-11eb-8103-e01691331ec1.PNG)

![a-is-main_controller1](https://user-images.githubusercontent.com/71874910/94903046-25e0cf00-04d4-11eb-83b4-dac12ae0daf9.PNG)

## Installation
```bash
$ git clone https://github.com/SonyCSL/apis-main_controller.git
$ cd apis-main_controller
$ virtualenv apis-main_controller
$ source apis-main_controller/bin/activate
$ pip install bottle==0.12.8
$ pip install requests=2.4.3
$ pip install pytz==2012c
$ deactivate
```

## Running
```bash
$ cd apis-main_controller
$ source apis-main_controller/bin/activate
$ python startMain.py
```


## Documentation
&emsp;[apis-mian_controller_specification(JP)](https://github.com/SonyCSL/apis-main_controller/blob/master/doc/jp/apis-main_controller_specification.md)



## License
&emsp;[Apache License Version 2.0](https://github.com/oes-github/apis-main-controller/blob/master/LICENSE)


## Notice
&emsp;[Notice](https://github.com/oes-github/apis-main-controller/blob/master/NOTICE.md)
