<!DOCTYPE html>
<head>
<meta http-equiv="content-type" content="text/html; charset=utf-8"/>
<title>
{{ title }} </title>
<link rel="stylesheet" type="text/css" href="./css/style.css">
<!--[if lt IE 9]>
<script type="text/javascript">
alert("Your browser does not support the canvas tag.");
</script>
<![endif]-->
<script src="https://code.jquery.com/jquery-1.7.2.js" crossorigin="anonymous"></script>
<script src="https://code.jquery.com/ui/1.8.19/jquery-ui.js" crossorigin="anonymous"></script>
<script src="./js/visual.js" type="text/javascript">
      </script>
<script src="./js/main.js" type="text/javascript">
      </script>
<link rel="stylesheet" type="text/css" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css">
</head>
<body>
<div class="boxes">
	<div>
		<div class="debugger debuggerdiv">Global Mode :</div>
		<div class="debugger operationModeDisp global">--</div>
		<div style="display:none" class="debugger operationModeDisp global autonomous">Run</div>
		<div style="display:none" class="debugger operationModeDisp global heteronomous">Soft Stop</div>
		<div style="display:none" class="debugger operationModeDisp global stop">Force Stop</div>
		<div style="display:none" class="debugger operationModeDisp global manual">Manual</div>
	</div>
	<div>
		<div class="debugger debuggerdiv">
			<select class="operationModeSelection global">
				<option value="--">--</option>
				<option value="autonomous">Run</option>
				<option value="heteronomous">Soft Stop</option>
				<option value="stop">Force Stop</option>
				<option value="manual">Manual</option>
			</select>
		</div>
		<input type="button" class="setOperationModeButton global" value="Set" />
	</div>
	<div class="clearfix">
		<div>Soft Stop Schedule :</div>
		<div class="schedule">
			<div class="softStopScheduleDisp global">--</div>
			<input type="button" class="setSoftStopScheduleButton global" value="Set" />
			<input type="button" class="clearSoftStopScheduleButton global" value="Clear" />
		</div>
	</div>
	<input type="button" class="debugbutton shutDownButton global" value="Shut Down" disabled="disabled" /><br>
	<div id="debugtext" class="debugger debuggerdiv">debug</div>
	<input type="checkbox" id="debug" class="debugger"/> <br>
	<input type="button" id="flush" class="debugbutton" value="Flush cache" />
	<br>
	<input type="button" id="stopall" class="debugbutton" value="Stop all" />
	<br>
	<div class="time">Timestamp : </div>
	<div id=emulator style="display: none;">{{ emulator }}</div>
	<ul id=deals> </ul>
</div>
<div id="content">
<div class=inlineBox>
<div id=titleDiv>{{ title }}</div>

<div id="busvoltagediv">
Bus voltage: <input class="textfield" type="text" id="busvoltage" value="350"/>
</div>
</div>
	<div>
		<canvas id="mainCanvas" width="1024" height="600" style="background:#fff">
		</canvas>
	</div>

%i=0
%for house in oes_tuples:
	<div id="field{{house[0]}}" class="fields">
		<div id="counter" style="display: none;">{{i}}</div>
		<h1 class="ip">{{house[1]}}</h1>
		<h2 class="displayName">{{house[0]}} : {{house[2]}}</h2>

		<div>
			<div class="debugger debuggerdiv">Effective Mode :</div>
			<div class="debugger operationModeDisp effective">--</div>
			<div style="display:none" class="debugger operationModeDisp effective autonomous">Run</div>
			<div style="display:none" class="debugger operationModeDisp effective heteronomous">Soft Stop</div>
			<div style="display:none" class="debugger operationModeDisp effective stop">Force Stop</div>
			<div style="display:none" class="debugger operationModeDisp effective manual">Manual</div>
		</div><br/>
		<div>
			<div class="debugger debuggerdiv">Local Mode :</div>
			<div class="debugger operationModeDisp local">--</div>
			<div style="display:none" class="debugger operationModeDisp local heteronomous">Soft Stop</div>
			<div style="display:none" class="debugger operationModeDisp local stop">Force Stop</div>
		</div><br/>
		<div>
			<div class="debugger debuggerdiv">
				<select class="operationModeSelection local">
					<option value="--">--</option>
					<option value="">( clear )</option>
					<option value="heteronomous">Soft Stop</option>
					<option value="stop">Force Stop</option>
				</select>
			</div>
			<input type="button" unitId="{{house[0]}}" class="setOperationModeButton local" value="Set" />
		</div>
		<div class="clearfix">
			<div class="debugger debuggerdiv">Soft Stop Schedule :</div>
			<div class="debugger">
				<div class="softStopScheduleDisp local">--</div>
				<input type="button" unitId="{{house[0]}}" class="setSoftStopScheduleButton local" value="Set" />
				<input type="button" unitId="{{house[0]}}" class="clearSoftStopScheduleButton local" value="Clear" />
			</div>
		</div>
		<input type="button" unitId="{{house[0]}}" class="debugbutton shutDownButton local" value="Shut Down" disabled="disabled" /><br>

		<form id="{{house[0]}}">
		<input type="radio" name="status" value="0x0000" checked disabled="disabled">
		Stopped <br>		
		<input type="radio" name="status" value="0x0014" disabled="disabled">
		Voltage control <br>
		<!--
		<input type="radio" name="status" value="0x0041" disabled="disabled">
		Heteronomy CV Charging<br>
		<input type="radio" name="status" value="0x0002" disabled="disabled">
		Heteronomy CV Discharging <br>
		-->
		<input type="radio" name="status" value="cc" disabled="disabled">
		Current control <br>
		<br>
		<div class="inputTextfield">Grid current : <input class="textfield" type="text" name="dig" id="dig" value="--" disabled="disabled" /><br />
		<!--
		Grid voltage : <input class="textfield" type="text" name="dvg" id="dvg" disabled="disabled" /><br>
		-->
		</div>
		<div class="field1 buttons">
 		<input type="button" class="read" value="Refresh" disabled="disabled" />
	  	<input type="button" class="set" value="Set" disabled="disabled" />
		</div><br>
		<div class="meter">
			<div class="meterelem">Grid voltage<br><div class="vg">--</div></div>
			<div class="meterelem">Grid current<br><div class="ig">--</div></div>
			<div class="meterelem">Grid power<br><div class="wg">--</div></div><br>
			<div class="meterelem">Battery voltage<br><div class="vb">--</div></div>
			<div class="meterelem">Battery current<br><div class="ib">--</div></div>
			<div class="meterelem">Battery power<br><div class="wb">--</div></div><br>
			<div class="meterelem" style="display: none;">Temperature<br><div class="tmp"style="display: none;">--</div></div>
		</div>
		<div class="battery">Battery Status : --</div>
		<div class="loss">Operating power : --</div>
		<div class="charge_discharge_power">Charge discharge power : --</div>
		<div class="pvc_charge_power">PVC charge power : --</div>
		<div class="p1">Electricity Demand : --</div>
		<div class="p2">UPS input power : --</div>
		<div class="ups_output_power">UPS output power : --</div>
		<div class="ups_input_voltage">UPS input voltage : --</div>
		<div class="ups_output_voltage">UPS output voltage : --</div>
		<div class="error emuerror"></div>
		<div class="error dcdcerror"></div>
		</form>
		
	</div>
	%i=i+1
	%end


</div>
<div id="setScheduleDialog" style="display:none">
	<div class="error"></div>
	<div class="inputTextfield">Schedule :
		<input class="textfield year" type="text" maxlength="4" />-<input class="textfield month" type="text" maxlength="2" />-<input class="textfield day" type="text" maxlength="2" />
		<input class="textfield hour" type="text" maxlength="2" />:<input class="textfield minute" type="text" maxlength="2" />
	</div>
</div>
</body>
</html>
