

var ids = [];
var debug=false;
var busvoltage=350
var emulator=false;
var embeddedBudo=false;

$(document).ready(function () {
	$("form").each(function() {
		ids.push(this.id);   
	});

	initVis();
	getCachedAll(true);
	if( ($('#emulator').html())=="True"){
		emulator=true;
		if( ($('#embeddedBudo').html())=="True"){
			embeddedBudo=true;
////			$('#budo').prop("checked", true);
////			$('#budo').hide();
////		}else{
////			setInterval(function(){isBudoRunning()}, 1000);
		}
		setInterval(function(){getCachedAll(false)}, 1000);
	}else{
////		isBudoRunning();
		setInterval(function(){getCachedAll(false)}, 3000);
////		setInterval(function(){isBudoRunning()}, 30000);
	}
	 //every 30s or so update
	debugMode()
	//isBudoRunning()

})



$(function () {
	$('.setOperationModeButton.global').click(function() {
		var value = $('.operationModeSelection.global').val();
		if (value != '--') {
			$.getJSON('./setOperationMode', {'value':value}, function(json) {
				$('.operationModeSelection.global').val('--');
			});
		}
	});
	$('.setOperationModeButton.local').click(function() {
		var unitId = $(this).attr('unitId');
		var value = $('#field' + unitId + ' .operationModeSelection.local').val();
		if (value != '--') {
			$.getJSON('./setOperationMode', {'unitId':unitId, 'value':value}, function(json) {
				$('#field' + unitId + ' .operationModeSelection.local').val('--');
			});
		}
	});
//	$('.setSoftStopScheduleButton').click(function() {
//		var unitId = $(this).attr('unitId');
//		var prompt = 'Enter ' + (unitId != null ? unitId : 'Global') + ' Soft Stop Schedule :'
//		var error = '';
//		var now = new Date();
//		var val = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate() + ' ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
//		while (true) {
//			val = window.prompt(error + prompt, val);
//			if (val == null) break;
//			var ts = Date.parse(val);
//			if (!isNaN(ts)) {
//				var dt = new Date(val);
//				if (new Date().getTime() < dt.getTime()) {
//					var value = dt.toISOString().replace('Z', '+00:00');
//					$.get('./setSchedule', {'operation':'softStop', 'unitId':unitId, 'value':value});
//					break;
//				} else {
//					error = 'Schedule should be future value.\n';
//				}
//			} else {
//				error = 'Format error.\n';
//			}
//		}
//	});
	$('.setSoftStopScheduleButton').click(function() {
		var unitId = $(this).attr('unitId');
		if (!unitId) unitId = '';
		$.getJSON("./schedules", function(json) {
			if (json) {
				var dt = null;
				if (json[unitId] && json[unitId]['softStop']) {
					dt = new Date(json[unitId]['softStop']);
				} else {
					dt = new Date();
				}
				$('#setScheduleDialog .error').text('');
				$('#setScheduleDialog .year').val(dt.getFullYear());
				$('#setScheduleDialog .month').val(dt.getMonth() + 1);
				$('#setScheduleDialog .day').val(dt.getDate());
				$('#setScheduleDialog .hour').val(dt.getHours());
				$('#setScheduleDialog .minute').val(dt.getMinutes());
				$('#setScheduleDialog').dialog({
					title: (unitId ? unitId : 'Global') + ' Soft Stop Schedule',
					modal: true,
					width: 350,
					height: 'auto',
					buttons: {
						'Set': function() {
							var year = parseInt($('#setScheduleDialog .year').val());
							var month = parseInt($('#setScheduleDialog .month').val());
							var day = parseInt($('#setScheduleDialog .day').val());
							var hour = parseInt($('#setScheduleDialog .hour').val());
							var minute = parseInt($('#setScheduleDialog .minute').val());
							if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute)) {
								dt = new Date(year, month - 1, day, hour, minute, 0, 0);
								if (new Date().getTime() < dt.getTime()) {
									var value = dt.toISOString().replace('Z', '+00:00');
									$.get('./setSchedule', {'operation':'softStop', 'unitId':unitId, 'value':value});
									$(this).dialog('close');
								} else {
									$('#setScheduleDialog .error').text('Schedule should be future value');
								}
							} else {
								$('#setScheduleDialog .error').text('Bad value(s)');
							}
						}
					}
				});
			}
		});
	});
	$('.clearSoftStopScheduleButton').click(function() {
		var unitId = $(this).attr('unitId');
		$.get('./setSchedule', {'operation':'softStop', 'unitId':unitId});
	});
	$('.shutDownButton').click(function() {
		var unitId = $(this).attr('unitId');
		$.get('./shutDown', {'unitId':unitId});
	});

////	$('#budo').change(function() {
////		budo=this.checked;
////		url ="./set/budo/";
////		if (budo) 
////			url += "active";
////		else 
////			url +="stop";
////		$.getJSON(url, function (json) {
////			updateBudoStatus(json);
////		});
////	});

	$('#debug').change(function() {
		debug=this.checked;
		debugMode();
	});

	$(".read").click(function () {
		var form = $(this).parents('form');
		getOne($(form).attr('id'))
		//var url = "./get/dcdc/"+$(form).attr('id')+"?urgent=true";
		//sendGet(url, form);
	});

	$("#flush").click(function() {
////		isBudoRunning();
		flushCache();
		location.reload();
	});

	$("#stopall").click(function() {
		//console.log("stopping all");
		$.getJSON("./stopAll", function (json) {
			location.reload();
		});
	});

	$(".set").click(function () {
		var form = $(this).parents('form');
		var dig = $(form).find('#dig').val();
		//var dvg = $(form).find('#dvg').val();
		var dvg = $('#busvoltage').val();
		var mode = $(form).find('input[name=status]:radio:checked').val();			

		if (mode=="cc") {
			if (parseFloat(dig)>=0){
				mode="0x0041";
			} else {
				mode="0x0002";
				dig = -parseFloat(dig);
				dvg=parseFloat(dvg)+20 //needs to be above bus voltage in order to discharge
			}
		}
		//if(mode=="0x0014"){
		//	dig="6.5"
		//}

		var param = '?mode=' + mode + '&dvg=' + dvg + '&dig=' +dig;// + "&callback=?";
		var id = $(form).attr('id')
		var url = "./set/dcdc/"+id+param;//'http://' + $(form).find('.ip').text() + ":" + bottlePort + "/remote/set" + param;
		sendGet(url, id, form);
		//getNowAll()
	});

	function sendGet(url, id, form) {
		$.getJSON(url, function (json) {
			updateDCDC(form,id, json);
			//refresh values again
			getOne(id)
		});
	}


});


function getPastRequest(id,from,granularity){
	return undefined;
}
//update from cached values
function getCachedAll(isstatusupdate) {
////	if ($('#budo').prop("checked") || embeddedBudo){
		getBudoDeals();	
////	}
	$.getJSON("./get/logInfo", function (json) {
		processGetLog(json);
		for (id in json){
			if($.inArray(id,ids)>-1 ){
				//console.log("known id "+id);
				updateOne(id, isstatusupdate, json[id]);
			}
			else{
				;//console.log("====new id "+id);
			}
		}
		updateDisabledGlobal(json);
	});
	dispSchedules();
}

//request direct call to all bbb
function getNowAll() {
	for (i=0;i<ids.length; i++){
		getOne(ids[i]);
	}
}


function getOne(id){
	$.getJSON("./get/unit/"+id+"?urgent=true", function (json) {
		updateOne(id, true, json)
	}, "html");

}

function updateOne(id, isUpdateStatus, json){
	if (json.apis) {
		updateGlobalOperationMode(json);
		updateLocalOperationMode(id, json);
		updateGridMaster(id, json);
		updateDisabled(id, json);
	}
	var form =$('#field'+id).find("form");
	$(".time").text(json.time);
	if(json.dcdc.error && debug){
		$(form).find(".dcdcerror").text("DCDC Error: "+json.dcdc.error);
	}else{
		$(form).find(".dcdcerror").text("");
		if (isUpdateStatus){
			updateDCDC(form, id, json.dcdc);
		}
		else{
			updateMeter(id, json.dcdc.meter);
			updatePowerMeter(id, json.dcdc.powermeter);
		}
	}

	if(json.emu && json.emu.error && debug){
		$(form).find(".emuerror").text("EMU Error: "+json.emu.error);
	}else{
		$(form).find(".emuerror").text("");
		updateEmu(id, json.emu);
	}
	updateBattery(id, json.battery);
}


function updateDCDC(form, id, json){
	var status = json.status.status;
	//var dvg = json.vdis.dvg;
	var dig = json.param.dig;
	$(form).find('#dig').val(dig);
	//$(form).find('#dvg').val(dvg);
	$(form).find('input[name=status]:radio:checked').prop('checked', false);
	if(status=="0x0041"){
		$(form).find('input[name=status]:radio[value=cc]').prop('checked', true);
	}
	else if (status=="0x0002"){
		$(form).find('input[name=status]:radio[value=cc]').prop('checked', true);
		$(form).find('#dig').val(-dig);
	}
	else{
		$(form).find('input[name=status]:radio[value=' + status + ']').prop('checked', true);
	}
	updateMeter(id, json.meter);
	updatePowerMeter(id,json.powermeter)
}

function updatePowerMeter(id, powermeter){
	if(powermeter && powermeter.hasOwnProperty("p1")){
		$('#field'+id).find(".p1").text("P1: total elec demand: "+powermeter.p1.toFixed(0));
		$('#field'+id).find(".p2").text("P2: UPS input power: "+powermeter.p2.toFixed(0));
	}
}

function updateMeter(id, meterjson){
	var meterdiv = $('#field'+id).find(".meter");
	$(meterdiv).find(".vg").text((meterjson["vg"]) ? Math.round(meterjson["vg"] * 100) / 100 : meterjson["vg"]);
	$(meterdiv).find(".ig").text((meterjson["ig"]) ? Math.round(meterjson["ig"] * 100) / 100 : meterjson["ig"]);
	$(meterdiv).find(".wg").text((meterjson["wg"]) ? Math.round(meterjson["wg"] * 100) / 100 : meterjson["wg"]);
	$(meterdiv).find(".vb").text((meterjson["vb"]) ? Math.round(meterjson["vb"] * 100) / 100 : meterjson["vb"]);
	$(meterdiv).find(".ib").text((meterjson["ib"]) ? Math.round(meterjson["ib"] * 100) / 100 : meterjson["ib"]);
	$(meterdiv).find(".wb").text((meterjson["wb"]) ? Math.round(meterjson["wb"] * 100) / 100 : meterjson["wb"]);
	$(meterdiv).find(".tmp").text((meterjson["tmp"]) ? Math.round(meterjson["tmp"] * 100) / 100 : meterjson["tmp"]);
	var loss= meterjson["wb"]-meterjson["wg"];
	$('#field'+id).find(".loss").text("Operating power: "+loss.toFixed(0)+" W");



	//the json data is meterjson
	//ERASE ALL THE THINGS!!!
	var keys = [];
	var values = [];
	var counter = $('#field'+id).find("#counter").text();
	if(parseInt(counter)<3){
		for (key in meterjson) {
			keys.push(key);
			values.push(meterjson[key]);
		}
		//console.log(counter)
		//console.log(keys);
		//console.log(values);
		//pjs.updateServer(counter, keys, values);
	}

	//STOP ERASE
}

function updateEmu(id, jsonemu) {
	if (jsonemu) {
		$('#field'+id).find(".charge_discharge_power").text("Charge discharge power: "+jsonemu.charge_discharge_power.toFixed(0));
		$('#field'+id).find(".ups_output_power").text("UPS output power: "+jsonemu.ups_output_power.toFixed(0));
		$('#field'+id).find(".pvc_charge_power").text("PVC charge power: "+jsonemu.pvc_charge_power.toFixed(0));
		$('#field'+id).find(".ups_output_voltage").text("UPS output voltage: "+jsonemu.ups_output_voltage);
		$('#field'+id).find(".ups_input_voltage").text("UPS input voltage: "+jsonemu.ups_input_voltage);
		var counter = $('#field'+id).find("#counter").text();
		//console.log(counter);
		if(parseInt(counter)<3){
			var ok = false;
			keys = [];
			values = [];
			for (key in jsonemu) {
				keys.push(key);
				values.push(jsonemu[key]);
				ok = true;
			}
			if(ok) {
				//console.log(counter);
				//console.log(keys);
				//console.log(values);
				//pjs.updateServerEmu(counter, keys, values);
			}
		}
	} else {
		$('#field'+id).find(".charge_discharge_power").text("Charge discharge power: --");
		$('#field'+id).find(".ups_output_power").text("UPS output power: --");
		$('#field'+id).find(".pvc_charge_power").text("PVC charge power: --");
		$('#field'+id).find(".ups_output_voltage").text("UPS output voltage: --");
		$('#field'+id).find(".ups_input_voltage").text("UPS input voltage: --");
	}
}
function updateBattery(id, json) {
	if (json) {
		$('#field'+id).find(".meter").siblings(".battery").text("Battery Status : "+json.rsoc+"%");
	} else {
		$('#field'+id).find(".meter").siblings(".battery").text("Battery Status : --");
	}
}



function debugMode() {
	if (debug) {
		$(".loss").show();
		$(".charge_discharge_power").show();
		$(".ups_output_power").show();
		$(".pvc_charge_power").show();
		//$(".ups_output_voltage").show();
		//$(".ups_input_voltage").show();
		$(".p1").show();
		$(".p2").show();
		$(".time").show();
	} else {
		$(".loss").hide();
		$(".charge_discharge_power").hide();
		$(".ups_output_power").hide();
		$(".pvc_charge_power").hide();
		$(".ups_output_voltage").hide();
		$(".ups_input_voltage").hide();
		$(".p1").hide();
		$(".p2").hide();
		$(".time").hide();
	}
}


////function isBudoRunning(){
////	$.getJSON("./get/globalmode", function (json) {
////		updateBudoStatus(json);
////	});
////	
////}

function flushCache(){
	$.getJSON("./flushCache");
}

function updateGlobalOperationMode(json) {
	$('.operationModeDisp.global.*').hide();
	$('.operationModeDisp.global.' + json.apis.operation_mode.global).show();
}
function updateLocalOperationMode(unitId, json) {
	$('#field' + unitId + ' .operationModeDisp.local.*').hide();
	$('#field' + unitId + ' .operationModeDisp.local.' + json.apis.operation_mode.local).show();
	$('#field' + unitId + ' .operationModeDisp.effective.*').hide();
	$('#field' + unitId + ' .operationModeDisp.effective.' + json.apis.operation_mode.effective).show();
}
function updateGridMaster(unitId, json) {
	if (json.apis.is_grid_master) {
		$('#field' + unitId).addClass('isGridMaster');
	} else {
		$('#field' + unitId).removeClass('isGridMaster');
	}
}
function updateDisabled(unitId, json) {
	if ('manual' == json.apis.operation_mode.effective) {
		$('#' + unitId + ' input').removeAttr('disabled');
		$('#field' + unitId + ' .shutDownButton.local').removeAttr('disabled');
	} else {
		//$('#' + unitId + ' .read').attr('disabled', 'disabled');
		$('#' + unitId + ' input').attr('disabled', 'disabled');
		$('#field' + unitId + ' .shutDownButton.local').attr('disabled', 'disabled');
	}
	$('#' + unitId + ' .read').removeAttr('disabled');
}
function updateDisabledGlobal(json) {
	for (id in json) {
		if ('manual' == json[id].apis.operation_mode.effective) {
			$('.shutDownButton.global').removeAttr('disabled');
		} else {
			$('.shutDownButton.global').attr('disabled', 'disabled');
		}
		break;
	}
}

////function updateBudoStatus(json){
////	//console.log(JSON.stringify(json));
////	if(json.error){
////		$('#budoStatus').text("Budo not running");
////		$('#budo').prop("checked", false);
////		$('#budo').hide();
////	}
////	else {
////		$('#budo').show();
////		if(json.active){
////			$('#budoStatus').text("Budo  active");
////			$('#budo').prop("checked", true);
////			getBudoDeals();
////		}
////		else{
////			$('#budoStatus').text("Budo stopped");
////			$('#budo').prop("checked", false);
////			$('#deals').text("");
////		}
////		
////	}
////}

function getBudoDeals(){
	$.getJSON("./get/dealsInfo", function (json) {
		 processDeals(json);
		var deals=$('#deals');
		$(deals).text("");
		if(json.error){
			$('#budo').prop("checked", false);
			$('#budo').hide();
		}
		else {
			// in this case we know budo is running
			if(json.length>0){
				$.each(json, function(i){
					$(deals).append(getItem(json[i]));
				});
////				if (!embeddedBudo){
////					$('#budo').show();
////					$('#budoStatus').text("Budo  active");
////					$('#budo').prop("checked", true);
////				}
			}

		}
	});
}

function getItem(item) {
	var out="<li>";
	out+= item["request"]+"<br>";
	out+= "requester: " + item["requester"]+"<br>";
	out+= "responder: "+ item["responder"]+"<br>"
	out+= item["startTime"]+"<br>";
	//console.log(item["isMasterDeal"]);
	if (item["isMasterDeal"]){
		out+="masterDeal<br>";
	}
	out+="</li>";
	return out;
}

function dispSchedules() {
	$.getJSON("./schedules", function(json) {
		dispScheduleDate(null, 'softStop', null);
		$.each(ids, function(i, unitId) {
			dispScheduleDate(unitId, 'softStop', null);
		});
		$.each(json, function(unitId, schedules) {
			if ('softStop' in schedules) {
				var date = new Date(schedules.softStop);
				dispScheduleDate(unitId, 'softStop', date);
			}
		});
	});
}
function dispScheduleDate(unitId, type_, value) {
	var sel, txt;
	if (unitId) {
		sel = '#field' + unitId + ' .' + type_ + 'ScheduleDisp.local';
	} else {
		sel = '.' + type_ + 'ScheduleDisp.global';
	}
	if (value != null) {
		txt = value.getFullYear() + '/' + (value.getMonth() + 1) + '/' + value.getDate() + ' ' + ('0' + value.getHours()).slice(-2) + ':' + ('0' + value.getMinutes()).slice(-2);
	} else {
		txt = '--';
	}
	$(sel).text(txt);
}

