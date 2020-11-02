var frameCount = 0;
var ctx;
var canvas;
var w;
var h;

var MAX_PVC = 3000;
var MAX_CONSU = 3000;
var MAX_AC_GRID = 3000;
var MAX_DC_GRID = 1000;

var SCALE_EP = 2000;

var LOW_PVC = 200;
var LOW_CONSU = 100;
var LOW_AC_GRID = 400;
var LOW_DCDC = 40;

var MODE_ALL = 0;
var MODE_SINGLE = 1;
var MODE_SINGLE2ALL = 2;
var MODE_ALL2SINGLE = 3;
var timeModeChange = -1;
var singleId = -1;
var mode = MODE_ALL;
var loading = false;
var oesNode = {x:200,y:200};
var snapshot=undefined;
var numExchanges =0;

var lastPulse = -1;

var MODE_USER=0;
var MODE_ADMIN=1;
var modeUser=MODE_ADMIN;
var me;

var ofset=-1;
var day=false;
var globalGranularity;
var allData = {};
var allWeather = {};

var max_all_pvc=0;
var max_all_dcdc = 0;
var max_all_use = 0;

var max_single_pvc=0;
var max_single_dcdc = 0;
var max_single_use = 0;

var white=false;
var latestGlobalUpdate = -1;

var latestWeather={};
var oesHover=false;

var debug=false;

var dealsViz=[];
var timeNow;

var globalScale=1;


var Color = function(r,g,b){
	 this.r=r;
	 this.g=g;
	 this.b=b;
}
var Point = function(x,y){
	 this.x=x;
	 this.y=y;
}


var colorLerp = function(sc, ec, f) {
	 var r = sc.r*(1-f)+(f)*ec.r;
	 var g = sc.g*(1-f)+(f)*ec.g;
	 var b = sc.b*(1-f)+(f)*ec.b;
	 return colorString(r*255,g*255,b*255);
}

var distance = function(pt0, pt1){
	 return Math.sqrt( (pt1.x-pt0.x)*(pt1.x-pt0.x)+(pt1.y-pt0.y)*(pt1.y-pt0.y));
}

var EnergyPath = function( points, startCol, endCol,size,  phase){
	 this.points = points;
	 this.startCol = startCol;
	 this.endCol = endCol;
	 this.phase = phase;
	 this.lengths = new Array();
	 this.size=size;

	 //compute length between the pairs of points
	 //lengths is the list of lengths from the start
	 this.lengths.push(0);
	 for(var i = 0, len=points.length-1 ; i<len ; ++i){
			var pt0 = points[i];
			var pt1 = points[i+1];
			var l = distance(pt0,pt1);
			if(this.lengths.length>0) l+=this.lengths[this.lengths.length-1];
			this.lengths.push(l);
	 }

	 //the complete length
	 this.totallength=this.lengths[this.lengths.length-1];
}


EnergyPath.prototype.draw = function(dt){
	 if(dt==undefined) return;
	 if(dt==null) return;
	 //add the time to the phase
	 this.phase+=dt;
	 if(this.phase>1) this.phase-=1;
	 if(this.phase<0) this.phase+=1;
	 //one rect every 5 pixels
	 var n = Math.floor(this.totallength/10);

	 for(var i = 0; i < (n);++i){
			//the point at i
			var frac = (i+this.phase)/n;
			if(frac>=1) frac-=1;
			if(frac<0) frac+=1;
			//on which part of the path the rect is?
			var k=0;
			while( (k < this.lengths.length) && ((frac*this.totallength) >= this.lengths[k]) ){
				 k++;
			}
			//console.log(k);
			//k is the segment
			if(k!=1) {
				 //console.log("k is " +k);
				 //console.log(this.lengths);
				 //console.log(frac);
				 //console.log(frac*this.totalLength);
				 k=1;
			}
			var ff = (frac*this.totallength - this.lengths[k-1])/(this.lengths[k]-this.lengths[k-1]);
			var x = this.points[k-1].x*(1-ff) + (ff)*this.points[k].x;
			var y = this.points[k-1].y*(1-ff) + (ff)*this.points[k].y;
			var cc= colorLerp(this.startCol, this.endCol, frac);
			ctx.fillStyle = cc;
			ctx.fillRect(x-this.size, y-this.size, this.size*2, this.size*2);
	 }

}

var Deal = function (data) {
	 this.start = Date.now();
	 this.exists = true;
	 
	 this.isMasterDeal = data.isMasterDeal;
	 this.requester = data.requester;
	 this.responder = data.responder;
	 this.request = data.request;
	 this.startTime = data.startTime;
	 this.chargingUnit = data.chargingUnit;
	 this.dischargingUnit = data.dischargingUnit;
	 /*
	 this.isMasterDeal = data.is_master_deal;
	 this.requester = data.requester_house_id;
	 this.responder = data.responder_house_id;
	 this.request = data.request;
	 this.startTime = data.start_time;
	 this.chargingUnit = data.charging_house_id;
	 this.dischargingUnit = data.discharging_house_id;
	 */
	 this.full=false;
	 this.phase = 0;
}

Deal.prototype.equals = function (one) {
	 var ret = true;
	 ret = (this.isMasterDeal == one.isMasterDeal && this.requester == one.requester && this.responder == one.responder && this.request == one.request && this.startTime == one.startTime && this.chargingUnit == one.chargingUnit && this.dischargingUnit == one.dischargingUnit);
	 //console.log("Compare result "+true);
	 return ret;
}

var Server = function (id, name) {
	 this.name = name;
	 this.id = id;
	 /* individual values */
	 this.rsoc = 0;
	 this.pvc = 0;
	 this.acgrid = 0;
	 this.consu = 0;
	 /* with OES */
	 this.dcgrid = 0;
	 this.dcdc_status = 0;
	 this.ups_mode = 0;

	 /* position */
	 this.posx = 0;
	 this.posy = 0;
	 this.moved=false;
	 /* phases for flow */
	 this.phaseSolar = 0;
	 this.phaseOES = 0;
	 /* max for energy */
	 this.max_pvc = 0;
	 this.max_use = 0;
	 this.max_dcdc = 0;

	 /* upkeep */
	 this.exists = true;
	 this.mode = 0;

	 /* history */
	 this.history = {};
	 this.weather = {};

	 this.lastUpdate = -1;

	 /* energy paths */

	 var Pt0 = new Point(50,5);
	 var Pt1 = new Point(50,95);
	 var pts0 = [Pt0,Pt1];
	 this.epPVC = new EnergyPath(pts0, new Color(1,1,1), new Color(0,1,0), 2, 0);

	 var Pt2 = new Point(0,90);
	 var Pt3 = new Point(25,90);
	 var pts1 = [Pt2,Pt3];
	 this.epGRID = new EnergyPath(pts1, new Color(1,0,0), new Color(0,1,0), 2, 0);

	 var Pt4 = new Point(75,90);
	 var Pt5 = new Point(100,90);
	 var pts2 = [Pt4,Pt5];
	 if(white){
			this.epCONS = new EnergyPath(pts2, new Color(0,1,0), new Color(0,1,0), 2, 0);
	 } else {
			this.epCONS = new EnergyPath(pts2, new Color(0,1,0), new Color(1,1,1), 2, 0);
	 }

	 var Pt6 = new Point(50,150);
	 var Pt7 = new Point(50,100);
	 var pts3 = [Pt6,Pt7];
	 if(white){
			this.epDCDC = new EnergyPath(pts3, new Color(0,0,0), new Color(0,1,0), 2, 0);
	 } else {
			this.epDCDC = new EnergyPath(pts3, new Color(1,1,1), new Color(0,1,0), 2, 0);
	 }
}

Server.prototype.pushAway = function (all) {
	 for( var id in all ) {
			var other = all[id];
			if( this.id != id) {
				 var d = Math.sqrt(( this.posx - other.posx)*( this.posx -other.posx)+ (this.posy- other.posy)*(this.posy-other.posy));
				 if(d<140){
						other.posx += (other.posx-this.posx)*2/d;
						other.posy += (other.posy-this.posy)*2/d;
						this.posx -= (other.posx-this.posx)*2/d;
						this.posy -= (other.posy-this.posy)*2/d;
						//				ctx.strokeStyle="white";
						//				ctx.beginPath();
						//				ctx.moveTo(this.posx,this.posy);
						//				ctx.lineTo(other.posx,other.posy);
						//				ctx.stroke();
						//				ctx.strokeStyle="none";
				 }
			}
	 }
}
Server.prototype.pullTowards = function (other) {
	 var d = Math.sqrt(( this.posx - other.posx)*( this.posx -other.posx)+ (this.posy- other.posy)*(this.posy-other.posy));
	 if(d>180){
			var f = (d-180)/180;
			this.posx += (other.posx-this.posx)*10/d*f*f*f;
			this.posy += (other.posy-this.posy)*10/d*f*f*f;
			//		ctx.strokeStyle="blue";
			//		ctx.beginPath();
			//		ctx.moveTo(other.x,other.y);
			//		ctx.lineTo(this.posx,this.posy);
			//		ctx.stroke();
			//		ctx.strokeStyle="none";
	 }
}
Server.prototype.pushAwaySingle = function (other) {
	 var d = Math.sqrt(( this.posx - other.x)*( this.posx -other.x)+ (this.posy- other.y)*(this.posy-other.y));
	 if(d<140){
			this.posx -= (other.x-this.posx)*1/(d);
			this.posy -= (other.y-this.posy)*1/(d);
			//		ctx.strokeStyle="red";
			//		ctx.beginPath();
			//		ctx.moveTo(other.x,other.y);
			//		ctx.lineTo(this.posx,this.posy);
			//		ctx.stroke();
			//		ctx.strokeStyle="none";

			this.moved=true;
	 }
	 if(d<200 && Math.abs(this.dcgrid)<LOW_DCDC ){
			this.posx -= (other.x-this.posx)*10/(d);
			this.posy -= (other.y-this.posy)*10/(d);

	 }
}

Server.prototype.pushInside = function (x0,y0,x1,y1) {
	 var needed=false; 
	 if(this.posx < (60+x0)) {
		 this.posx+=3;
		 needed=true;
	 }
	 if(this.posx > (x1-60)) {
		 this.posx-=3;
		 needed=true;
	 }
	 if(this.posy < (60+y0)) {
		 this.posy+=3;
		 needed=true;
	 }
	 if(this.posy > (y1-60)) {
		 this.posy-=3;
		 needed=true;
	 }
	 return needed;
}


Server.prototype.distanceTo = function(x,y){
	 return Math.sqrt( (x-this.posx)*(x-this.posx)+(y-this.posy)*(y-this.posy));
}

var greenc = new Color(0,1,0);
var bluec = new Color(0,0,1);
var whitec = new Color(1,1,1);
var blackc = new Color(0,0,0);

Server.prototype.drawOES = function (){
	 if(Math.abs(this.dcgrid)<LOW_DCDC)return;
	 //draws the energy flow to OES node
	 var length = this.distanceTo(oesNode.x, oesNode.y);
	 var n = length/15;
	 //add the phase from this.dcgrid

	 this.phaseOES -= this.dcgrid/10000;
	 //if dcgrid is neg -> output from here (that's why it's -)
	 if(this.phaseOES>=1) this.phaseOES-=1;
	 if(this.phaseOES<0) this.phaseOES+=1;

	 //ctx.strokeStyle = "white";
	 //ctx.beginPath();
	 //ctx.moveTo(oesNode.x, oesNode.y);
	 //ctx.lineTo(this.posx,this.posy);
	 //ctx.stroke();

	 for(var i = 0;i<n;++i){
			var f = (i+this.phaseOES)/n;
			var x = (1-f)*this.posx + f*oesNode.x;
			var y = (1-f)*this.posy + f*oesNode.y;
			if(white){
				 ctx.fillStyle = colorLerp( greenc, blackc, f);
			} else {
				 ctx.fillStyle = colorLerp( greenc, whitec, f);
			}
			ctx.fillRect(x-2,y-2,4,4);
	 }

}

Server.prototype.drawSingle = function() {
	ctx.save();
	 if(modeUser == MODE_ADMIN || (me != undefined && this.id == me.house)){
			if(white){
				 ctx.fillStyle="black";
			} else {
				 ctx.fillStyle="white";
			}
			ctx.fillText(this.name, w-200+20,20);
			//ctx.fillText(this.id, w-200+20,20);
	 }
	 ctx.translate(w-150,h/2-50);
	 this.drawSimple(1);
	 ctx.restore();
}

Server.prototype.drawHistory = function(){
	 //draw the background, legend etc
	 ctx.save();

	 var widthPanel=672;
	 var heightRow = 120;
	 var realHeightRow = 110;

	 var ofsetH = 120;
	 var ofsetW=824-widthPanel-10;
	 if(white){
			ctx.fillStyle = "rgb(155,155,155)";
	 } else {
			ctx.fillStyle = "rgb(55,55,55)";
	 }
	 ctx.fillRect(ofsetW,ofsetH ,widthPanel,realHeightRow);
	 ctx.fillRect(ofsetW,ofsetH+1*heightRow,widthPanel,realHeightRow);
	 ctx.fillRect(ofsetW,ofsetH+2*heightRow,widthPanel,realHeightRow);
	 ctx.fillRect(ofsetW,ofsetH+3*heightRow,widthPanel,realHeightRow);

	 ctx.fillRect(823,0,2,600);

	 var green=0;
	 var blue=0;
	 //draw history
	 var data=this.history;
	 var weatherData = this.weather;
	 if(data.length>0){
			loading=false;
			//draw one line from past
			var numEntries = data.length;
			//split the history in days
			//
			//ofset and day


			//add labels according to days
			//add weather afterwards

			//get timestamps
			//if undefined...
			var index0 = 0;
			while(data[index0] == undefined)index0++;
			var dateFrom = new Date(data[index0].timestamp*1000);
			var dateNoon = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate(), 12,00);

			var dateFromTs = dateFrom.getTime();
			var widthDay = 24*60/(globalGranularity/60);
			ctx.fillStyle = "rgb(75,75,75)";
			ctx.textAlign="center";
			var shiftDay=0;
			if(day==false) {
				 shiftDay=-widthDay/2;
			}
			var countDay=0;
			for(var j=7;j>=0;--j){
				 if(white) {
						ctx.fillStyle="black";
				 } else {
						ctx.fillStyle="white";
				 }
				 if(j==0){
						if(ofset>3*widthDay/8 || (day==false && (shiftDay+ofsetW-ofset+widthDay/4<0))){
							 ctx.fillText(dateNoon.getMonth()+1+"/"+dateNoon.getDate(),shiftDay+ ofsetW+widthPanel-ofset+widthDay/4, 100);
						}
				 } else {
						var x=widthPanel-widthDay*j-ofset+shiftDay;
						if(x>0) {
							 ctx.fillText(dateNoon.getMonth()+1+"/"+dateNoon.getDate(), ofsetW+x+widthDay/4, 100);
						}
						//draw weather
						if(ofsetW+x+widthDay/4+widthDay < 780 && weatherData[countDay]!=undefined) {
							 switch(weatherData[countDay].forecast_icons) {
									case 8: //sun
										 drawSun(ofsetW+x+widthDay/4+widthDay,30,10);
										 break;
									case 3: //cloud+rain
										 drawCloud(ofsetW+x+widthDay/4+widthDay+5,43);
										 drawRain(ofsetW+x+widthDay/4+widthDay+5,43);
										 break;
									case 6: //sun+cloud
										 drawSun(ofsetW+x+widthDay/4+widthDay,30,10);
										 drawCloud(ofsetW+x+widthDay/4+widthDay+5,43);
										 break;
									case 7: //sun+cloud+rain
										 drawSun(ofsetW+x+widthDay/4+widthDay,30,10);
										 drawCloud(ofsetW+x+widthDay/4+widthDay+5,43);
										 drawRain(ofsetW+x+widthDay/4+widthDay+5,43);
										 break;
									case 2: //cloud
										 drawCloud(ofsetW+x+widthDay/4+widthDay+5,43);
										 break;
									default:
										 break;
							 }
						}
						countDay=countDay+1;
				 }

				 if(white){
						ctx.fillStyle = "rgb(175,175,175)";
				 } else {
						ctx.fillStyle = "rgb(75,75,75)";

				 }
				 for(var i=0;i<4;++i){
						if(j==0) {
							 var x=widthPanel-widthDay*j+shiftDay;
							 var w=ofset;
							 //if(x>(widthPanel-ofsetW)) {
							 //continue;
							 //}

							 if(day && ofset>widthDay/2){
									w=widthDay/2;
							 }
							 if(day==false) w=widthDay/2;
							 //console.log(ofsetW+x-ofset);
							 if( ofsetW+x-ofset+w > (widthPanel+ofsetW)) continue;
							 ctx.fillRect(ofsetW+x-ofset,ofsetH+heightRow*i,w,realHeightRow);
						} else {
							 var x=widthPanel-widthDay*j-ofset+shiftDay;
							 var w=widthDay/2;
							 if(x<0) {
									w=widthDay/2+x;
									x=0;
							 }
							 ctx.fillRect(ofsetW+x,ofsetH+heightRow*i,w,realHeightRow);
						}
				 }
				 dateNoon = new Date(dateNoon.getTime()+24*60*60*1000);
			}

			//can't push matrix so can't use translate T_T
			//ctx.translate(0,ofsetH+realHeightRow);
			ctx.beginPath();
			ctx.strokeStyle = "rgb(255,255,100)";
			for(var i=0;i<numEntries;++i){
				 if(data[i]==undefined)continue;
				 var dataNow = data[i];
				 var datax = ofsetW+widthPanel-numEntries+i;
				 ctx.moveTo(datax,ofsetH+realHeightRow);
				 ctx.lineTo(datax,ofsetH+realHeightRow-realHeightRow*dataNow.pv_power/this.max_pvc);
			}
			ctx.stroke();
			ctx.beginPath();
			ctx.strokeStyle = "rgb(255,100,100)";
			for(var i=0;i<numEntries;++i){
				 if(data[i]==undefined)continue;
				 var dataNow = data[i];
				 var datax = ofsetW+widthPanel-numEntries+i;
				 ctx.moveTo(datax,ofsetH+1*heightRow+realHeightRow);
				 ctx.lineTo(datax,ofsetH+1*heightRow+realHeightRow-realHeightRow*Math.abs(dataNow.ac_input_power)/this.max_use);
			}
			ctx.stroke();
			ctx.beginPath();
			ctx.strokeStyle="rgb(100,255,100)";
			green=0;
			blue=0;
			for(var i=0;i<numEntries;++i){
				 if(data[i]==undefined)continue;
				 var dataNow = data[i];
				 var datax = ofsetW+widthPanel-numEntries+i;
				 var diff = Math.abs(dataNow.out_power)-Math.abs(dataNow.ac_input_power);
				 green = green + Math.abs(dataNow.out_power);
				 blue = blue+Math.abs(dataNow.ac_input_power);
				 if(diff>0){
						//green = green+diff;
						ctx.moveTo(datax,ofsetH+1*heightRow+realHeightRow);
						ctx.lineTo(datax,ofsetH+1*heightRow+realHeightRow-realHeightRow*diff/this.max_use);
				 }
			}
			ctx.stroke();
			ctx.beginPath();
			for(var i=0;i<numEntries;++i){
				 if(data[i]==undefined)continue;
				 var dataNow = data[i];
				 var datax = ofsetW+widthPanel-numEntries+i;
				 ctx.strokeStyle = "rgb(0,255,0)";
				 ctx.moveTo(datax,ofsetH+2*heightRow+realHeightRow-realHeightRow/2);
				 ctx.lineTo(datax,ofsetH+2*heightRow+realHeightRow-realHeightRow/2-realHeightRow/2*dataNow.dc_power/this.max_dcdc);
			}
			ctx.stroke();
			//ctx.translate(0,heightRow);
			ctx.beginPath();
			for(var i=0;i<numEntries;++i){
				 if(data[i]==undefined)continue;
				 var dataNow = data[i];
				 var datax = ofsetW+widthPanel-numEntries+i;
				 ctx.strokeStyle = "rgb(100,255,100)";
				 ctx.moveTo(datax,ofsetH+3*heightRow+realHeightRow);
				 ctx.lineTo(datax,ofsetH+3*heightRow+realHeightRow-realHeightRow*dataNow.rsoc/100);
			}
			ctx.stroke();
	 }

	 ctx.font = "12px Verdana";
	 ctx.textBaseline = 'top';
	 if(white) {
			ctx.fillStyle = "rgb(80,80,80)";
	 } else {
			ctx.fillStyle = "rgb(180,180,180)";
	 }
	 ctx.textAlign = "right";
	 ctx.fillText((this.max_pvc/1000)+"KW", ofsetW-4, ofsetH+2);
	 ctx.fillText((this.max_use/1000)+"KW", ofsetW-4, ofsetH+2+heightRow);
	 ctx.fillText((this.max_dcdc/1000)+"KW", ofsetW-4, ofsetH+2+2*heightRow);
	 ctx.fillText("100%", ofsetW-4, ofsetH+2+3*heightRow);
	 ctx.textBaseline = 'alphabetic';
	 ctx.fillText("0W", ofsetW-4, ofsetH+realHeightRow);
	 ctx.fillText("0W", ofsetW-4, ofsetH+realHeightRow+heightRow);
	 ctx.textBaseline = 'middle';
	 ctx.fillText("0W", ofsetW-4, ofsetH+realHeightRow+2*heightRow-realHeightRow/2);
	 ctx.textBaseline = 'alphabetic';
	 ctx.fillText("-"+(this.max_dcdc/1000)+"KW", ofsetW-4, ofsetH+2*heightRow+realHeightRow);
	 ctx.fillText("0%", ofsetW-4, ofsetH+realHeightRow+3*heightRow);
	 ctx.font = "14px Verdana";

	 ctx.textAlign="left";
	 ctx.textBaseline='middle';
	 if(white) {
			ctx.fillStyle="black";
	 } else {
			ctx.fillStyle="white";
	 }
	 ctx.fillText("Solar Energy", 10, ofsetH+realHeightRow/2);
	 ctx.fillText("Energy Used", 10, ofsetH+realHeightRow/2+heightRow);
	 ctx.fillText("Energy", 10, ofsetH+realHeightRow/2+heightRow*2-10);
	 ctx.fillText("Exchanged", 10, ofsetH+realHeightRow/2+heightRow*2+10);
	 ctx.fillText("Battery Level", 10, ofsetH+realHeightRow/2+heightRow*3);

	 if(debug) { 
			ctx.fillText("Used "+(green/4).toFixed() + " Bought "+(blue/4).toFixed()+ " Eff "+ (((green-blue)/blue)*100).toFixed(2),200,257);
	 }
	 ctx.font = "12px Verdana";
	 ctx.textAlign="center";
	 ctx.fillStyle = "white";
	 if(loading) {
			ctx.fillText("Loading data...",824/2,h/2);
	 }
	 ctx.textAlign="left";
	 ctx.restore();
	 //ctx.setTransform(1,0,0,1,0,0);

}

function drawCloud(x,y){
	 ctx.fillStyle = "rgb(200,200,200)";
	 ctx.beginPath();
	 ctx.moveTo(x-10,y);
	 ctx.lineTo(x+10,y);
	 ctx.arc(x+10,y-5,5,Math.PI/2,3*Math.PI/2,true);
	 ctx.arc(x+7,y-10,3,0,Math.PI,true);
	 ctx.arc(x-3,y-10,7,0,Math.PI,true);
	 //ctx.lineTo(x-10,y-10);
	 ctx.arc(x-10,y-5,5,Math.PI/2,3*Math.PI/2);
	 ctx.fill();
}

function drawRain(x,y){
	 ctx.strokeStyle = "rgb(200,200,255)";
	 ctx.beginPath();
	 for(var i=0;i<7;++i){
			ctx.moveTo(x-7+3*i,y);
			ctx.lineTo(x-7+3*i-10,y+10);
	 }
	 ctx.stroke();
}
function drawSun(x,y,r){

	 ctx.fillStyle = "rgb(255,255,0)";
	 ctx.beginPath();
	 ctx.arc(x,y,r,0,2*Math.PI);
	 ctx.fill();
	 ctx.strokeStyle = "rgb(255,255,0)";
	 ctx.beginPath();
	 for(var i=0;i<10;++i){
			var a = i*Math.PI*2/10;
			ctx.moveTo(x + Math.cos(a)*(r*1.1), y+Math.sin(a)*(r*1.1));
			ctx.lineTo(x + Math.cos(a)*(r*1.5), y+Math.sin(a)*(r*1.5));
	 }
	 ctx.stroke();
}

function drawAllHistoryFrom(data){
	ctx.save();
	 //draw the background, legend etc
	 var widthPanel=672;
	 var heightRow = 120;
	 var realHeightRow = 110;

	 var ofsetH = 120;
	 var ofsetW=824-widthPanel-10;
	 if(white){
			ctx.fillStyle = "rgb(155,155,155)";
	 } else {
			ctx.fillStyle = "rgb(55,55,55)";
	 }
	 ctx.fillRect(ofsetW,ofsetH ,widthPanel,realHeightRow);
	 ctx.fillRect(ofsetW,ofsetH+1*heightRow,widthPanel,realHeightRow);
	 ctx.fillRect(ofsetW,ofsetH+2*heightRow,widthPanel,realHeightRow);
	 ctx.fillRect(ofsetW,ofsetH+3*heightRow,widthPanel,realHeightRow);

	 ctx.fillRect(823,0,2,600);

	 var green=0;
	 var blue=0;
	 //draw history
	 if(data.length>0){
			loading=false;
			//draw one line from past
			var numEntries = data.length;
			//split the history in days
			//
			//ofset and day


			//add labels according to days
			//add weather afterwards

			//get timestamps
			var dateFrom = new Date(data[0].timestamp*1000);
			var dateNoon = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate(), 12,00);

			var dateFromTs = dateFrom.getTime();
			var widthDay = 24*60/(globalGranularity/60);
			ctx.fillStyle = "rgb(75,75,75)";
			ctx.textAlign="center";
			var shiftDay=0;
			if(day==false) {
				 shiftDay=-widthDay/2;
			}
			var countDay=0;
			for(var j=7;j>=0;--j){
				 if(white){
						ctx.fillStyle="black";
				 } else {
						ctx.fillStyle="white";
				 }
				 if(j==0){
						if(ofset>3*widthDay/8 || day==false){
							 ctx.fillText(dateNoon.getMonth()+1+"/"+dateNoon.getDate(),shiftDay+ ofsetW+widthPanel-ofset+widthDay/4, 100);
						}
				 } else {
						var x=widthPanel-widthDay*j-ofset+shiftDay;
						if(x>0 && x<widthPanel) {
							 ctx.fillText(dateNoon.getMonth()+1+"/"+dateNoon.getDate(), ofsetW+x+widthDay/4, 100);
						}
						//draw weather
						if((ofsetW+x+widthDay/4+widthDay) < 780 && allWeather[countDay]!=undefined){
							 switch(allWeather[countDay].forecast_icons) {
									case 8: //sun
										 drawSun(ofsetW+x+widthDay/4+widthDay,30,10);
										 break;
									case 3: //cloud+rain
										 drawCloud(ofsetW+x+widthDay/4+widthDay+5,43);
										 drawRain(ofsetW+x+widthDay/4+widthDay+5,43);
										 break;
									case 7: //sun+cloud+rain
										 drawSun(ofsetW+x+widthDay/4+widthDay,30,10);
										 drawCloud(ofsetW+x+widthDay/4+widthDay+5,43);
										 drawRain(ofsetW+x+widthDay/4+widthDay+5,43);
										 break;
									case 6: //sun+cloud
										 drawSun(ofsetW+x+widthDay/4+widthDay,30,10);
										 drawCloud(ofsetW+x+widthDay/4+widthDay+5,43);
										 break;
									case 2: //cloud
										 drawCloud(ofsetW+x+widthDay/4+widthDay+5,43);
										 break;
									default:
										 break;
							 }
						}
						countDay=countDay+1;

				 }

				 if(white){
						ctx.fillStyle = "rgb(175,175,175)";
				 } else {
						ctx.fillStyle = "rgb(75,75,75)";
				 }
				 for(var i=0;i<4;++i){
						if(j==0) {
							 var x=widthPanel-widthDay*j+shiftDay;
							 var w=ofset;

							 if(day && ofset>widthDay/2){
									w=widthDay/2;
							 }
							 if(day==false) w=widthDay/2;
							 if( ofsetW+x-ofset+w > (widthPanel+ofsetW)) continue;
							 ctx.fillRect(ofsetW+x-ofset,ofsetH+heightRow*i,w,realHeightRow);
						} else {
							 var x=widthPanel-widthDay*j-ofset+shiftDay;
							 var w=widthDay/2;
							 if(x<0) {
									w=widthDay/2+x;
									x=0;
							 }
							 ctx.fillRect(ofsetW+x,ofsetH+heightRow*i,w,realHeightRow);
						}
				 }
				 dateNoon = new Date(dateNoon.getTime()+24*60*60*1000);
			}

			//can't push matrix so can't use translate T_T
			//ctx.translate(0,ofsetH+realHeightRow);
			ctx.beginPath();
			ctx.strokeStyle = "rgb(255,255,100)";
			for(var i=0;i<numEntries;++i){
				 if(data[i]==undefined)continue;
				 var dataNow = data[i];
				 var datax = ofsetW+widthPanel-numEntries+i;
				 ctx.moveTo(datax,ofsetH+realHeightRow);
				 ctx.lineTo(datax,ofsetH+realHeightRow-realHeightRow*dataNow.pvc_charge_power/max_all_pvc);
			}
			ctx.stroke();
			ctx.beginPath();
			ctx.strokeStyle = "rgb(255,100,100)";
			for(var i=0;i<numEntries;++i){
				 if(data[i]==undefined)continue;
				 var dataNow = data[i];
				 var datax = ofsetW+widthPanel-numEntries+i;
				 ctx.moveTo(datax,ofsetH+1*heightRow+realHeightRow);
				 ctx.lineTo(datax,ofsetH+1*heightRow+realHeightRow-realHeightRow*Math.abs(dataNow.ups_output_power)/max_all_use);
			}
			ctx.stroke();
			ctx.strokeStyle = "rgb(0,255,0)";
			ctx.beginPath();
			for(var i=0;i<numEntries;++i){
				 if(data[i]==undefined)continue;
				 var dataNow = data[i];
				 var datax = ofsetW+widthPanel-numEntries+i;

				 green = green + Math.abs(dataNow.ups_output_power);
				 blue = blue+Math.abs(dataNow.p2);
				 ctx.moveTo(datax,ofsetH+2*heightRow+realHeightRow);
				 ctx.lineTo(datax,ofsetH+2*heightRow+realHeightRow-realHeightRow*Math.abs(dataNow.in_dcdc_grid_power)/max_all_dcdc);
			}
			ctx.stroke();
			//ctx.translate(0,heightRow);
			ctx.beginPath();
			for(var i=0;i<numEntries;++i){
				 if(data[i]==undefined)continue;
				 var dataNow = data[i];
				 var datax = ofsetW+widthPanel-numEntries+i;
				 ctx.strokeStyle = "rgb(100,255,100)";
				 ctx.moveTo(datax,ofsetH+3*heightRow+realHeightRow);
				 ctx.lineTo(datax,ofsetH+3*heightRow+realHeightRow-realHeightRow*dataNow.mean_rsoc/100);
			}
			ctx.stroke();
	 }



	 ctx.font = "12px Verdana";
	 ctx.textBaseline = 'top';
	 if(white){
			ctx.fillStyle = "rgb(80,80,80)";
	 } else {
			ctx.fillStyle = "rgb(180,180,180)";
	 }
	 ctx.textAlign = "right";
	 ctx.fillText((max_all_pvc/1000)+"KW", ofsetW-4, ofsetH+2);
	 ctx.fillText((max_all_use/1000)+"KW", ofsetW-4, ofsetH+2+heightRow);
	 ctx.fillText((max_all_dcdc/1000)+"KW", ofsetW-4, ofsetH+2+2*heightRow);
	 ctx.fillText("100%", ofsetW-4, ofsetH+2+3*heightRow);
	 ctx.textBaseline = 'alphabetic';
	 ctx.fillText("0W", ofsetW-4, ofsetH+realHeightRow);
	 ctx.fillText("0W", ofsetW-4, ofsetH+realHeightRow+heightRow);
	 ctx.fillText("0W", ofsetW-4, ofsetH+realHeightRow+2*heightRow);
	 ctx.textBaseline = 'alphabetic';
	 ctx.fillText("0%", ofsetW-4, ofsetH+realHeightRow+3*heightRow);
	 ctx.font = "14px Verdana";

	 ctx.textAlign="left";
	 ctx.textBaseline='middle';
	 if(white){
			ctx.fillStyle="black";
	 } else {
			ctx.fillStyle="white";
	 }
	 ctx.fillText("Solar Energy", 10, ofsetH+realHeightRow/2);
	 ctx.fillText("Energy Used", 10, ofsetH+realHeightRow/2+heightRow);
	 ctx.fillText("Energy", 10, ofsetH+realHeightRow/2+heightRow*2-10);
	 ctx.fillText("Exchanged", 10, ofsetH+realHeightRow/2+heightRow*2+10);
	 ctx.fillText("Battery Level", 10, ofsetH+realHeightRow/2+heightRow*3);

	 if(debug){
			ctx.fillText("Used "+(green/4).toFixed() + " Bought "+(blue/4).toFixed()+ " Eff "+ (((green-blue)/blue)*100).toFixed(2),200,257);
	 }
	 ctx.font = "12px Verdana";
	 ctx.textAlign="center";
	 ctx.fillStyle = "white";
	 if(loading) {
			ctx.fillText("Loading data...",824/2,h/2);
	 }
	 ctx.textAlign="left";
	 //ctx.setTransform(1,0,0,1,0,0);
	 ctx.restore();

}

Server.prototype.draw = function (detail) {
	 //get in position
	 ctx.save();
	 ctx.translate(this.posx - 50, this.posy -50);
	 this.drawSimple(detail);
	 ctx.restore();
}

Server.prototype.drawSimple = function (detail) {

	 ctx.fillStyle = "black";
	 //shape
	 ctx.fillRect(25,0,50,5);
	 ctx.fillRect(45,5,10,10);
	 ctx.fillRect(25,15,50,85);

	 if(me != undefined && this.id == me.house && detail!=1){
			if(white) {
				 ctx.strokeStyle="red";
			} else {
				 ctx.strokeStyle="white";
			}
			ctx.lineWidth=3;
			ctx.strokeRect(25,0,50,5);
			ctx.strokeRect(45,5,10,10);
			ctx.strokeRect(25,15,50,85);
	 }


	 //EPs
	 if(Math.abs(this.pvc)>LOW_PVC) this.epPVC.draw(Math.abs(this.pvc/SCALE_EP*.1));
	 if(Math.abs(this.acgrid)>LOW_AC_GRID) this.epGRID.draw(Math.abs(this.acgrid/SCALE_EP*.1));
	 if(Math.abs(this.consu)>LOW_CONSU) this.epCONS.draw(Math.abs(this.consu/SCALE_EP*.1));
	 if(detail==1 && Math.abs(this.dcgrid)>LOW_DCDC) this.epDCDC.draw((this.dcgrid/SCALE_EP*.3));


	 //ups_mode == 2 -> battery
	 //ups_mode == 5 -> bypass

	 //fill with battery
	 ctx.fillStyle = "rgb(0,255,0)";
	 if(this.ups_mode!=undefined){
			switch(this.ups_mode){
				 case 2:
						ctx.fillStyle = "rgb(50,255,50)";
						break;
				 case 5:
						ctx.fillStyle = "rgb(0,200,0)";
						break;
				 default:
						break;
			}
	 }
	 if(this.isMaster) {
			//ctx.fillStyle = "rgb(185,255,0)";
	 }
	 if(this.exists==false) ctx.fillStyle="rgb(0,100,0)";
	 if(this.rsoc==null) this.rsoc =0;
	 var f = this.rsoc/100;
	 ctx.fillRect(26,15+(1-f)*84,48,f*84);

	 //solar panel
	 var ff = Math.floor(this.pvc*255/MAX_PVC);
	 ctx.fillStyle = colorString(ff,ff,ff);
	 ctx.fillRect(26,1,48,3);

	 if(this.isMaster) {
		 //crown
		 ctx.fillStyle="yellow";
		 ctx.strokeStyle="black";
		 ctx.beginPath();
		 ctx.moveTo(26,0);
		 ctx.lineTo(26-10,-30);
		 ctx.lineTo(26+12,-10);
		 ctx.lineTo(26+24,-30);
		 ctx.lineTo(26+36,-10);
		 ctx.lineTo(26+48+10,-30);
		 ctx.lineTo(26+48,0);
		 ctx.stroke();
		 ctx.fill();
	 }


	 if(detail==1){
			//draw the sun
			ctx.fillStyle = "rgb(255,255,0)";
			ctx.beginPath();
			ctx.arc(50,-65,15,0,2*Math.PI);
			ctx.fill();
			ctx.strokeStyle = "rgb(255,255,0)";
			ctx.beginPath();
			for(var i=0;i<10;++i){
				 var a = i*Math.PI*2/10;
				 ctx.moveTo(50 + Math.cos(a)*20, -65+Math.sin(a)*20);
				 ctx.lineTo(50 + Math.cos(a)*30, -65+Math.sin(a)*30);
			}
			ctx.stroke();



			//draw the grid plug
			if(white){
				 ctx.strokeStyle = "black";
			} else {
				 ctx.strokeStyle = "white";
			}

			ctx.beginPath();
			ctx.moveTo(25,86);
			ctx.lineTo(0,86);
			ctx.arc(-4,86,4,0,-Math.PI/2,true);
			ctx.lineTo(-5,98);
			ctx.arc(-4,94,4,Math.PI/2,0,true);
			ctx.lineTo(25,94);
			ctx.moveTo(-5,92);
			ctx.lineTo(-10,92);
			ctx.moveTo(-5,88);
			ctx.lineTo(-10,88);
			ctx.stroke();


			//the ac out to people
			ctx.beginPath();
			ctx.moveTo(75,86);
			ctx.lineTo(100,86);
			ctx.moveTo(75,94);
			ctx.lineTo(100,94);
			ctx.stroke();

			if(white) {
				 ctx.fillStyle = "black";
			} else {
				 ctx.fillStyle = "white";
			}
			drawEllipse(108,90,2,8);
			//ctx.beginPath();
			//ctx.ellipse(108,90,2,8,0,0,Math.PI*2);
			//ctx.fill();
			drawEllipse(112,90,2,8);
			//ctx.beginPath();
			//ctx.ellipse(112,90,2,8,0,0,Math.PI*2);
			//ctx.fill();
			drawEllipse(110,80,4,8);
			//ctx.beginPath();
			//ctx.ellipse(110,80,4,8,0,0,Math.PI*2);
			//ctx.fill();
			drawEllipse(110,70,4,4);
			//ctx.beginPath();
			//ctx.ellipse(110,70,4,4,0,0,Math.PI*2);
			//ctx.fill();


			//labels
			ctx.textAlign="center";
			if(white) {
				 ctx.fillStyle = "black";
			} else {
				 ctx.fillStyle = "white";
			}
			ctx.fillText(this.pvc+" W", 50,-15);
			ctx.fillText(this.acgrid+" W", 0,120);
			ctx.fillText(this.consu+" W", 100,120);
			if(Math.abs(this.dcgrid) > LOW_DCDC) ctx.fillText(this.dcgrid+" W", 50, 170);
	 }
	 if(detail>=1){
			var y=30;
			ctx.fillStyle="white";
			if(this.rsoc > 70) {
				 y=30+(1-f)*84;
				 ctx.fillStyle="black";
			}
			var rs=this.rsoc.toFixed();
			ctx.textAlign="center";
			ctx.textBaseline="alphabetic";
			ctx.strokeStyle="black";
			ctx.lineWidth = 4;
			//ctx.strokeText(rs+"%", 50, y);
			ctx.strokeStyle="none";
			ctx.lineWidth = 1;
			ctx.fillText(rs+"%", 50, y);
			ctx.textAlign="left";
	 }

	 //reset matrix
	 //ctx.setTransform(1,0,0,1,0,0);
}


Server.prototype.processHistory = function(data, granularity, weatherdata ){
	 this.history = data;
	 this.weather = weatherdata;
	 //find the oldest timestamp
	 var oldest = this.history[0].timestamp;
	 //how much
	 //we have w-200 pixels
	 var numEntries = this.history.length;
	 console.log(numEntries);

	 var dateFrom = new Date(this.history[0].timestamp*1000);
	 var dateTo = new Date(this.history[numEntries-1].timestamp*1000);
	 //find the start of the day
	 //in localized time (of the browser)! -> use getUTCHours
	 computeOfsetDayNight(dateFrom, dateTo,granularity);

	 //compute the max
	 max_single_pvc=0;
	 max_single_dcdc = 0;
	 max_single_use = 0;
	 for(var i=0;i<numEntries;++i){
			var dataNow = data[i];
			if(dataNow.pv_power > max_single_pvc) max_single_pvc = dataNow.pv_power;
			if(Math.abs(dataNow.dc_power) > max_single_dcdc) max_single_dcdc = Math.abs(dataNow.dc_power);
			if(Math.abs(dataNow.ac_input_power) > max_single_use) max_single_use = Math.abs(dataNow.ac_input_power);
			if(Math.abs(dataNow.out_power) > max_single_use) max_single_use = Math.abs(dataNow.out_power);
	 }
	 max_single_pvc = Math.ceil( max_single_pvc/1000) *1000;
	 max_single_dcdc = Math.ceil(max_single_dcdc/1000)*1000;
	 max_single_use = Math.ceil(max_single_use/1000)*1000;

	 this.max_pvc=max_single_pvc;
	 this.max_use=max_single_use;
	 this.max_dcdc=max_single_dcdc;

	 var mints = data[0].timestamp;
	 var maxts = data[numEntries-1].timestamp;
	 console.log(mints + " " + maxts);
	 maxts = latestGlobalUpdate;
	 mintx = maxts-7*24*3600;
	 console.log(mints + " " + maxts);
	 var dts = maxts-mintx;

	 //do we have all the data?
	 if(numEntries < 672){
			//console.log("error in his");
			//we need to refactor the data
			this.history = new Array(672);
			for(var i=0;i<numEntries;++i){
				 var ind= Math.floor((data[i].timestamp-mintx)/dts * this.history.length);
				 this.history[ind]=data[i];
				 if(ind<671)	this.history[ind+1]=data[i]; //the real value is overridden if exists
			}
	 }


	 //check weather
	 if(this.weather.length<8){

			this.weather={};

	 }




}

function computeOfsetDayNight(dateFrom, dateTo, granularity){
	 var hoursNow = dateTo.getUTCHours()+9;
	 if(hoursNow>23) hoursNow-=24;
	 console.log(dateFrom);
	 console.log(dateTo);
	 console.log(hoursNow);
	 //are we during the day?
	 day=false;
	 if(hoursNow>=6 && hoursNow<18){
			day=true;
	 }

	 //will not work in not JST time

	 //find the ofset to the previous 6:00 or 18:00
	 if(day==true){
			var previous6 = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 6, 0);
			ofset = dateTo.getTime() - previous6.getTime()
				 //1418137200
				 //1418100032
	 } else {
			var previous18 = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 18, 0);
			ofset = dateTo.getTime() - previous18.getTime()
	 }
	 console.log(ofset/1000);
	 console.log(ofset/(1000*granularity));
	 ofset = Math.floor(ofset/(1000*granularity));
}

function processAllHistory(data,granularity,weatherdata) {
	 allData = data;
	 allWeather = weatherdata;
	 var numEntries = allData.length;

	 var dateFrom = new Date(allData[0].timestamp*1000);
	 var dateTo = new Date(allData[numEntries-1].timestamp*1000);
	 //find the start of the day
	 //in localized time (of the browser)! -> use getUTCHours
	 computeOfsetDayNight(dateFrom, dateTo,granularity);

	 //find the max
	 max_all_pvc=0;
	 max_all_dcdc=0;
	 max_all_use=0;
	 for(var i = 0; i< numEntries;++i){
			var dataNow = allData[i];
			if(dataNow.pvc_charge_power > max_all_pvc) max_all_pvc = dataNow.pvc_charge_power;
			if(Math.abs(dataNow.in_dcdc_grid_power) > max_all_dcdc) max_all_dcdc = Math.abs(dataNow.in_dcdc_grid_power);
			if(Math.abs(dataNow.out_dcdc_grid_power) > max_all_dcdc) max_all_dcdc = Math.abs(dataNow.out_dcdc_grid_power);
			if(Math.abs(dataNow.p2) > max_all_use) max_all_use = Math.abs(dataNow.p2);
			if(Math.abs(dataNow.ups_output_power) > max_all_use) max_all_use = Math.abs(dataNow.ups_output_power);
	 }
	 max_all_pvc = Math.ceil( max_all_pvc/1000) *1000;
	 max_all_dcdc = Math.ceil(max_all_dcdc/1000)*1000;
	 max_all_use = Math.ceil(max_all_use/1000)*1000;
	 max_all_pvc = Math.max(max_all_pvc,max_all_use);
	 max_all_use = Math.max(max_all_pvc,max_all_use);

	 if(allWeather.length<8) allWeather={};

}





function drawEllipse(cx,cy,rx,ry){
	 ctx.beginPath();
	 for(var i = 0 ;i<20;++i){
			var angle = i*2*Math.PI/20;
			var x = cx + rx*Math.cos(angle);
			var y = cy + ry*Math.sin(angle);
			if(i==0) ctx.moveTo(x,y);
			else ctx.lineTo(x,y);
	 }
	 ctx.fill();
}


function getMousePos(canvas, evt) {
	 var rect = canvas.getBoundingClientRect();
	 return {
			x: oesNode.x+(evt.clientX - rect.left-oesNode.x)/globalScale,
			y: oesNode.y+(evt.clientY - rect.top-oesNode.y)/globalScale
	 };
}

function colorString(r,g,b) {
	 return "rgb("+Math.round(r)+","+Math.round(g)+","+Math.round(b)+")";
}

var servers = {};
var message = "";
var closest;

function mouseMove(e){
	 //put the name of the closest server
	 var mousePos = getMousePos(canvas, e);
	 message = "";

	 var d = 50;
	 closest=undefined;
	 for( var id in servers) {
			var s = servers[id];
			var dn = s.distanceTo(mousePos.x, mousePos.y);
			if(dn < d ){
				 d=dn;
				 closest = servers[id];
			}
	 }

	 var dToOes = Math.sqrt( (mousePos.x-oesNode.x)*(mousePos.x-oesNode.x)+(mousePos.y-oesNode.y)*(mousePos.y-oesNode.y));
	 oesHover=false;
	 if(modeUser == MODE_ADMIN && dToOes<d) {
			message = Object.keys(servers).length +" nodes connected to OES platform.";
			if(numExchanges>0) message = message +" " + numExchanges +" nodes exchanging energy.";
			oesHover=true;
	 } else {
			if(closest != undefined){
				 if(modeUser == MODE_ADMIN || (me != undefined && closest.id == me.house)){
						//console.log(closest.name);
						message = closest.name;
						for ( var id in dealsViz){
							 var d = dealsViz[id];
							 if( closest.id == d.chargingUnit || closest.id == d.dischargingUnit) {
									message += " is exchanging since "+d.startTime;
							 }
						}
						//message = closest.id;
				 }
			}
	 }
}

function mouseDown(e){
	 //processDatabase(fakedata);
	 //console.log("WithFakeD");


	 var mousePos = getMousePos(canvas, e);
	 switch(mode) {
			default:
				 break;
			case MODE_ALL:
				 var d = 50;
				 var closest;
				 for( var id in servers) {
						var s = servers[id];
						var dn = s.distanceTo(mousePos.x, mousePos.y);
						if(dn < d ){
							 d=dn;
							 closest = servers[id];
						}
				 }
				 var dToOes = Math.sqrt( (mousePos.x-oesNode.x)*(mousePos.x-oesNode.x)+(mousePos.y-oesNode.y)*(mousePos.y-oesNode.y));
				 if(dToOes<d){
						//closest to oesnode!
						mode = MODE_ALL2SINGLE;
						timeModeChange = new Date();
						//add refresh for img snapshot
						if(modeUser == MODE_ADMIN && snapshot != undefined) {
							 snapshot.src= snapshot.src+'?'+Math.random();
						}
						singleId = -2;
						getAll();
				 } else {
						if(closest!=undefined){
							 if(modeUser==MODE_USER){
									if(me != undefined && closest.id == me.house){
										 mode=MODE_ALL2SINGLE;
										 timeModeChange = new Date();
										 singleId=closest.id;
										 getPast(closest.id);
									}
							 } else {
									mode=MODE_ALL2SINGLE;
									timeModeChange = new Date();
									singleId=closest.id;
									getPast(closest.id);
							 }
						}
				 }
				 break;
			case MODE_SINGLE:
				 mode= MODE_SINGLE2ALL;
				 loading=false;
				 timeModeChange = new Date();
				 break;
	 }
}

function processPast(id, data, granularity, weatherdata) {
	 servers[id].processHistory(data.payload,granularity,weatherdata.payload);
}
function processPastAll(data, granularity, weatherdata) {
	 processAllHistory(data.payload,granularity,weatherdata.payload);
}

function getAll() {
	 //var now = Math.round(new Date().getTime()/1000);
	 var now = latestGlobalUpdate;
	 //var now = (Date.now()/1000).toFixed();
	 var from = now - 7*24*3600; //1 week data
	 var granularity = 600; // 10 min
	 var dateTo =  new Date(now*1000);
	 var dateNoon = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 0,00);
	 var toW=dateNoon.getTime()/1000+24*3600;
	 var fromW=toW-7*24*3600;
	 granularity = 60*15;
	 globalGranularity = granularity;
	 var t=getPastRequestAggregate(from,now, granularity,fromW,toW);
	 console.log(t);
	 if(t!=undefined) loading=true;
}

function getPast(id) {
	 //var now = Math.round(new Date().getTime()/1000);
	 var now = servers[id].lastUpdate;
	 var from = servers[id].lastUpdate - 7*24*3600; //1 week data
	 var granularity = 600; // 10 min
	 granularity = 60*15;
	 globalGranularity = granularity;
	 var dateTo = new Date(servers[id].lastUpdate*1000);
	 var dateNoon = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 0,00);
	 var toW=dateNoon.getTime()/1000+24*3600;
	 var fromW=toW-7*24*3600;
	 var d =getPastRequest(id,from,now,granularity,fromW, toW);
	 console.log(d);
	 if(d!=undefined)loading=true;
	 //console.log(data);
	 //if(data!=undefined){
	 //console.log("return past");
	 //servers[id].processHistory(data.payload, granularity);
	 //}

}


function processGetLog(data){
	 //parse the existing servers list to update the current ones,
	 //add new ones and remove the ones that disappeared
	 for( var id in servers ){
			var s = servers[id];
			s.exists = false;
	 }
	 var now = Date.now();
	 latestGlobalUpdate=-1;
	 for( var id in data){
			if( !(id in servers )){
				 //this is a new one
				 var name = data[id].oesunit.display;
				 servers[id] = new Server(id,name);
				 //console.log("new");
				 servers[id].posx = oesNode.x+Math.random()*10-5;
				 servers[id].posy = oesNode.y+Math.random()*10-5;
			}
			// update the values for the server
			servers[id].exists = true;
			var dateString = data[id].time;
			var y=dateString.substring(0,4);
			var m=dateString.substring(5,7);
			var d=dateString.substring(8,10);
			var hh=dateString.substring(11,13);
			var mm=dateString.substring(14,16);
			var ss=dateString.substring(17,19);
			var lastTstamp = new Date(y,m-1,d,hh,mm,ss);
			servers[id].lastUpdate = lastTstamp.getTime()/1000;
			//console.log(servers[id].lastUpdate);
			if(servers[id].lastUpdate>latestGlobalUpdate) latestGlobalUpdate = servers[id].lastUpdate;
			if(data[id].emu) servers[id].pvc = data[id].emu.pvc_charge_power;
			servers[id].rsoc = data[id].battery.rsoc;
			servers[id].dcdc_status = parseInt(data[id].dcdc.status.status); //parse hex
			if(typeof data[id].dcdc.powermeter == "object"){
				 if('p2' in data[id].dcdc.powermeter) {
						servers[id].acgrid = data[id].dcdc.powermeter.p2;
				 }
			} else {
				 servers[id].acgrid = 0;
			}
			if(data[id].emu) servers[id].consu = data[id].emu.ups_output_power;
			servers[id].dcgrid = data[id].dcdc.meter.wg;
	 }

	 for( var id in servers){
			if(servers[id].exists == false && servers[id].lastUpdate < (now - 60 * 1000)){
				 //no response in the last minute
				 delete servers[id];
			}
	 }


}

function processWeatherData(weatherData){
	 latestWeather = weatherData.payload[0];
}
function processDatabase(data){
	 var nume=0;
	 for( var id in servers ){
			var s = servers[id];
			s.exists = false;
	 }
	 var now = Date.now();
	 latestGlobalUpdate=-1;
	 for( var id in data.payload){
			if( !(id in servers )){
				 //this is a new one
				 var name = data.payload[id].label;
				 //name might be undefined
				 servers[id] = new Server(id,name);
				 servers[id].posx = oesNode.x+Math.random()*10-5;
				 servers[id].posy = oesNode.y+Math.random()*10-5;
			}
			// update the values for the server
			servers[id].exists = true;
			servers[id].lastUpdate = data.payload[id].timestamp;
			if(servers[id].lastUpdate>latestGlobalUpdate) latestGlobalUpdate = servers[id].lastUpdate;
			//console.log(servers[id].lastUpdate);
			//servers[id].lastUpdate = now;

			servers[id].dcdc_status = parseInt(data.payload[id].dcdc_status); //parse hex
			servers[id].ups_mode = data.payload[id].ups_mode; //parse hex

			servers[id].pvc = data.payload[id].pv_power;
			servers[id].rsoc = data.payload[id].rsoc;
			servers[id].acgrid = data.payload[id].ac_input_power;
			servers[id].consu = data.payload[id].out_power;
			servers[id].dcgrid = data.payload[id].dc_power;
			if(Math.abs(servers[id].dcgrid) > LOW_DCDC) nume+=1;
			//console.log(data.payload[id]);
	 }

	 numExchanges = nume;
	 //now we need to remove the servers that did not get updated now

	 for( var id in servers){
			if(servers[id].exists == false && servers[id].lastUpdate < (now - 60 * 1000)){
				 //no response in the last minute
				 delete servers[id];
			}
	 }

}


function mouseUp(e){
	 //console.log("MouseUp");
}

function smoothStep(x) {
	 return x*x*x*(x*(x*6 - 15) + 10);
}
function drawAllHistory(){
	 drawAllHistoryFrom(allData);
}
function drawSingleOes(){

	ctx.save();
	
	 ctx.translate(w-100,h/2-80);
	 ctx.fillStyle = "black";
	 ctx.strokeStyle = "none";
	 ctx.beginPath();
	 ctx.arc(0,0,30,0,2*Math.PI);
	 ctx.fill();
	 ctx.fillStyle = "white";
	 ctx.textAlign = "center";
	 ctx.textBaseline="middle";
	 ctx.fillText("OES",0,0);
	 ctx.textAlign = "left";
	 ctx.textBaseline="alphabetic";
	 if(snapshot!=undefined){
			ctx.drawImage(snapshot,-80,100,160,120);
	 }
	 //ctx.setTransform(1,0,0,1,0,0);
	 ctx.restore();



}
function drawAll() {

	 var now = Math.round(new Date().getTime());

	 /* draw pulse */
	 if(now > (lastPulse+3000) ){
			lastPulse = now;
	 }
	 var fracPulse = (now-lastPulse)/3000;

	 ctx.strokeStyle = "rgb(48,90,48)";
	 ctx.beginPath();
	 ctx.arc(oesNode.x, oesNode.y, fracPulse*1000, 0, 2*Math.PI);
	 ctx.stroke();

	 ctx.translate(oesNode.x,oesNode.y);
	 ctx.scale(globalScale, globalScale);
	 ctx.translate(-oesNode.x,-oesNode.y);

	 for( var key in servers){
			servers[key].isMaster = (0x0014 == servers[key].dcdc_status);
	 }

	 var now = Date.now();
	 for (var dis in dealsViz){
			var d = dealsViz[dis];
			var fromS = servers[d.dischargingUnit];
			var toS = servers[d.chargingUnit];
			if(fromS != undefined && toS != undefined){
			//draw line between the two
			if(now>d.start+2000){
				 var length = Math.sqrt( (fromS.posx-toS.posx)*(fromS.posx-toS.posx) + (fromS.posy-toS.posy)*(fromS.posy-toS.posy));
				 var n = length/15;
				 //add the phase from this.dcgrid
				 toS.pullTowards(fromS);
				 fromS.pullTowards(oesNode);
				 //toS.pullTowards(oesNode);

				 d.phase += toS.dcgrid/10000;
				 //if dcgrid is neg -> output from here (that's why it's -)
				 if(d.phase>=1) {
						d.phase-=1;
						d.full=true;
				 }
				 if(d.phase<0) {
					 	d.phase+=1;
						d.full=true;
				 }

				 //ctx.strokeStyle = "white";
				 //ctx.beginPath();
				 //ctx.moveTo(oesNode.x, oesNode.y);
				 //ctx.lineTo(this.posx,this.posy);
				 //ctx.stroke();


				 for(var i = 0;i<n;++i){
						var f = (i+d.phase)/n;
						if(f>1)f-=1;
						if(d.full==true || f<d.phase) {
							 if(f<0)f+=1;
							 //var x = (1-f)*fromS.posx + f*toS.posx;
							 //var y = (1-f)*fromS.posy + f*toS.posy;
							 var x = (1-f)*(1-f)*(1-f)*fromS.posx +3*f*(1-f)*(1-f)*oesNode.x + 3*f*f*(1-f)*oesNode.x+ f*f*f*toS.posx;
							 var y = (1-f)*(1-f)*(1-f)*fromS.posy +3*f*(1-f)*(1-f)*oesNode.y + 3*f*f*(1-f)*oesNode.y+ f*f*f*toS.posy;
							 if(white){
									ctx.fillStyle = colorLerp( greenc, blackc, f);
							 } else {

									//ctx.fillStyle = colorLerp( bluec, greenc, f);
									//}  else {
							 ctx.fillStyle = colorLerp( greenc, whitec, f);
							 //}
						}
						ctx.fillRect(x-2,y-2,4,4);
				 }
			}
	 } else {
			//first second
			var req = servers[d.requester];
			var res = servers[d.responder];

			if(req!=undefined && res !=undefined){
				var frac = (now-d.start)/2000.0;
				frac = smoothStep(frac);
				ctx.strokeStyle="white";
				ctx.beginPath();
				ctx.moveTo(req.posx, req.posy);
				ctx.lineTo((1-frac)*req.posx+frac*res.posx, (1-frac)*req.posy+frac*res.posy);
				ctx.stroke();
			}

	 }
	 }


}

var needToScale=false;
/* draw stuff */
for( var key in servers){
	 var slocal = servers[key];
	 //slocal.drawOES();
	 if(closest!=undefined){
			if(closest == slocal) {
				 slocal.draw(2);
			} else {
				 slocal.draw(0);
			}
	 } else {
			slocal.draw(0);
	 }
	 slocal.moved=false;
	 //the move away logic
	 //adapt for globalScale
	//x: oesNode.x+(evt.clientX - rect.left-oesNode.x)/globalScale,
	 var temp = slocal.pushInside(oesNode.x-oesNode.x/globalScale,oesNode.y*(1-1.0/globalScale),oesNode.x+(w-oesNode.x)/globalScale,oesNode.y+(h-oesNode.y)/globalScale);
	 if(temp) needToScale=true;
	 slocal.pushAwaySingle(oesNode);
	 if(Math.abs(slocal.dcgrid) > LOW_DCDC ){
			//slocal.pullTowards(oesNode);
	 }
}
if(Object.keys(servers).length>20){
	if(needToScale) globalScale*=.99;
}


for(var key in servers){
	 var slocal = servers[key];
	 //if(slocal.moved==false)
	 slocal.pushAway(servers);

	 //if there is an exchange, get closer to oesNode but not as strongly as pushAwaySingle
	 //so that you get close to it
}

ctx.fillStyle = "rgba(0,0,0,.7)";
ctx.strokeStyle = "none";
ctx.beginPath();
ctx.arc(oesNode.x,oesNode.y,30,0,2*Math.PI);
ctx.fill();
ctx.fillStyle = "white";
ctx.textAlign = "center";
ctx.textBaseline="middle";
ctx.fillText("OES",oesNode.x,oesNode.y);


//drawWeather on oes hover?
if(oesHover && latestWeather!=undefined && latestWeather.outside_temperature!=undefined){
	 ctx.fillStyle="black";
	 ctx.beginPath();
	 ctx.arc(oesNode.x,oesNode.y,90,0,2*Math.PI);
	 ctx.fill();
	 ctx.strokeStyle = "white";
	 ctx.beginPath();
	 ctx.arc(oesNode.x,oesNode.y,30,0,2*Math.PI);
	 ctx.fill();
	 ctx.stroke();
	 ctx.fillStyle = "white";
	 ctx.textAlign = "center";
	 ctx.textBaseline="middle";
	 ctx.fillText("OES",oesNode.x,oesNode.y);
	 var x=oesNode.x;
	 var y=oesNode.y-60;
	 switch(latestWeather.forecast_icons){
			case 8: //sun
				 drawSun(x,y,10);
				 break;
			case 3: //cloud+rain
				 drawCloud(x+4,y+4);
				 drawRain(x+4,y+4);
				 break;
			case 7: //sun+cloud+rain
				 drawSun(x,y,10);
				 drawCloud(x+5,y+13);
				 drawRain(x+5,y+13);
				 break;
			case 6: //sun+cloud
				 drawSun(x,y,10);
				 drawCloud(x+5,y+13);
				 break;
			case 2: //cloud
				 drawCloud(x,y);
				 break;
			default:
				 break;
	 }
	 ctx.fillStyle="white";
	 ctx.fillText(latestWeather.outside_temperature+" C", oesNode.x-60,oesNode.y);
	 ctx.fillText(latestWeather.solar_radiation, oesNode.x+60,oesNode.y-10);
	 ctx.fillText("W/m2", oesNode.x+60,oesNode.y+10);
	 //wind

	 ctx.strokeStyle="rgb(0,100,200)";
	 ctx.lineWidth = 3;
	 ctx.beginPath();
	 var angle= latestWeather.wind_direction*Math.PI/180 +Math.PI/2;
	 ctx.moveTo(oesNode.x-20+10*Math.cos(angle),oesNode.y+60+10*Math.sin(angle));
	 ctx.lineTo(oesNode.x-20-10*Math.cos(angle),oesNode.y+60-10*Math.sin(angle));
	 ctx.lineTo(oesNode.x-20-10*Math.cos(angle)+5*Math.cos(angle-Math.PI/4),oesNode.y+60-10*Math.sin(angle)+5*Math.sin(angle-Math.PI/4));
	 ctx.moveTo(oesNode.x-20-10*Math.cos(angle),oesNode.y+60-10*Math.sin(angle));
	 ctx.lineTo(oesNode.x-20-10*Math.cos(angle)+5*Math.cos(angle+Math.PI/4),oesNode.y+60-10*Math.sin(angle)+5*Math.sin(angle+Math.PI/4));
	 ctx.stroke();
	 ctx.textAlign="left";
	 var wsMS = latestWeather.wind_speed *0.44704;
	 ctx.fillText(wsMS.toFixed(1) + "m/s",oesNode.x,oesNode.y+60);
}



ctx.textAlign = "left";
ctx.textBaseline="alphabetic";
if(!loading) {
	ctx.save();
	ctx.setTransform(1,0,0,1,0,0);
	 if(white){
			ctx.strokeStyle="white";
			ctx.fillStyle = "black";
	 } else {
			ctx.strokeStyle="black";
			ctx.fillStyle = "white";
	 }
	 //ctx.lineWidth = 2;
	 ctx.beginPath();
	 //ctx.shadowColor="black";
	 //ctx.shadowOffsetX=0;
	 //ctx.shadowOffsetY=0;
	 //ctx.shadowBlur=1;

	 ctx.fillText(message,10,h-20);
	 //ctx.strokeText(message,10,h-20);
	 //ctx.shadowBlur=0;
	 //ctx.shadowColor="none";
	 //show time
	 if(latestGlobalUpdate!=-1){
			var now = new Date(latestGlobalUpdate*1000);
			var timeString = (now.getMonth()+1)+"/"+now.getDate()+ " " +now.getHours()+":"+now.getMinutes();
			if(now.getMinutes()<10) timeString=(now.getMonth()+1)+"/"+now.getDate()+ " " +now.getHours()+":0"+now.getMinutes();
			ctx.textAlign = "right";
			ctx.beginPath();
			ctx.fillText(timeString,w-10,h-20);
			//ctx.strokeText(timeString,w-10,h-20);
			ctx.textAlign = "left";
	 }
	 ctx.restore();
}
ctx.lineWidth=1;
ctx.strokeStyle = "none";

}

function draw(){
	 /* clears the back with the style background color */
	 ctx.clearRect(0,0,w,h);
	 ctx.save();
	 if(white){
			ctx.fillStyle = "white";
	 } else {
			ctx.fillStyle = "rgb(48,48,48)";
	 }
	 ctx.fillRect(0,0,w,h);

	 var now = new Date();
	 if(singleId!=-2){
			if(servers[singleId]==undefined){
				 //the server disappeared
				 mode = MODE_ALL;
				 singleId=-1;
			}
	 }
	 switch(mode){
			case MODE_ALL2SINGLE:
				 var diff = now.getTime() - timeModeChange.getTime();
				 var frac = smoothStep(diff/1000);
				 drawAll();

				 ctx.save();
				 ctx.setTransform(1,0,0,1,0,0);

				 if(white){
						ctx.fillStyle = "white";
				 } else {
						ctx.fillStyle = "rgb(100,101,100)";
				 }
				 ctx.translate(frac*824-824,0);
				 ctx.fillRect(0,0,824,h);
				 if(singleId==-2){
						drawAllHistory();
				 } else {
						servers[singleId].drawHistory();
				 }


				 //ctx.setTransform(1,0,0,1,0,0);
				 ctx.restore();

				 ctx.save();
				 ctx.setTransform(1,0,0,1,0,0);

				 ctx.translate(-frac*200,0);
				 if(white){
						ctx.fillStyle = "white";
				 } else {
						ctx.fillStyle = "rgb(100,100,100)";
				 }
				 ctx.fillRect(w,0,200,h);
				 ctx.translate(200,0);


				 if(singleId==-2){
						drawSingleOes();
				 } else {
						servers[singleId].drawSingle();
				 }

				 //ctx.setTransform(1,0,0,1,0,0);
				 ctx.restore();
				 if(diff>1000){
						mode = MODE_SINGLE;
				 }
				 break;
			case MODE_SINGLE2ALL:
				 var diff = now.getTime() - timeModeChange.getTime();
				 var frac = smoothStep(diff/1000);
				 drawAll();
				 ctx.save();
				 ctx.setTransform(1,0,0,1,0,0);
				 ctx.translate(-frac*824,0);
				 if(white){
						ctx.fillStyle = "white";
				 } else {
						ctx.fillStyle = "rgb(100,100,100)";
				 }
				 ctx.fillRect(0,0,824,h);
				 if(singleId==-2){
						drawAllHistory();
				 } else {
						servers[singleId].drawHistory();
				 }

				 ctx.restore();
				 ctx.save();
				 //ctx.setTransform(1,0,0,1,0,0);

				 ctx.setTransform(1,0,0,1,0,0);
				 ctx.translate(frac*200,0);
				 if(white){
						ctx.fillStyle = "white";
				 } else {
						ctx.fillStyle = "rgb(100,100,100)";
				 }
				 ctx.fillRect(w-200,0,200,h);
				 if(singleId==-2){
						drawSingleOes();
				 } else {
						servers[singleId].drawSingle();
				 }

				 //ctx.setTransform(1,0,0,1,0,0);
				 ctx.restore();
				 if(diff>1000){
						mode = MODE_ALL;
						singleId=-1;
				 }
				 break;
			case MODE_ALL:
				 drawAll();
				 break;
			case MODE_SINGLE:
				 if(white){
						ctx.fillStyle = "white";
				 } else {
						ctx.fillStyle = "rgb(100,100,100)";
				 }
				 ctx.fillRect(0,0,w,h);
				 if(singleId==-2){
						drawAllHistory();
						drawSingleOes();
				 } else {
						if(servers[singleId]!=undefined){
							 servers[singleId].drawSingle();
							 servers[singleId].drawHistory();
						}
				 }
				 break;
	 }

	 ctx.restore();
}

function update(timeStamp){
	 frameCount = frameCount+1;
	 draw();
	 window.requestAnimationFrame(update);
}


function initVisUser(data){
	 //console.log(data.payload);
	 if('payload' in data){
			me=data.payload;
			//<Enum: User, OesAdmin, Admin>
			if(me.role == "User") modeUser=MODE_USER; else modeUser=MODE_ADMIN;
			// if(modeUser == MODE_ADMIN){
			// 	 snapshot = new Image();
			// 	 snapshot.src= "https://example.com/latest.jpg"
			// }

	 } else {
			//not authorized
	 }
	 initVis();
}

function initVis() {

	 canvas = $( "#mainCanvas" )[0];
	 ctx= canvas.getContext("2d");
	 w = canvas.width;
	 h = canvas.height; //600
	 oesNode.y=h/2;
	 oesNode.x=w/2;
	 oesNode.posx=w/2;
	 oesNode.posy=h/2;
	 ctx.font = "12px Verdana";


	 /* register listeners */
	 canvas.addEventListener("mousemove", function (e) {
			mouseMove(e)
	 }, false);
	 canvas.addEventListener("mousedown", function (e) {
			mouseDown(e)
	 }, false);
	 canvas.addEventListener("mouseup", function (e) {
			mouseUp(e)
	 }, false);
	 /* start drawing */
	 window.requestAnimationFrame(update);
}

function processDeals(data){
	 //console.log(data);
	 //reset existence
	 for(var p in dealsViz) dealsViz[p].exists=false;
	 for(var newOne in data){
			if(data[newOne].hasOwnProperty("startTime")){	
				var isNew=true;
				for(var p in dealsViz) {

					 var dealLocal = dealsViz[p];
					 if(dealLocal.startTime == data[newOne].startTime &&
							dealLocal.requester == data[newOne].requester &&
							dealLocal.responder == data[newOne].responder){
					 //if(dealLocal.equals(data[newOne])==true) {
							dealLocal.exists=true;
							dealLocal.isMasterDeal = data[newOne].isMasterDeal;
							isNew=false;
					 }
					 /*
					 var dealLocal = dealsViz[p];
					 if(dealLocal.startTime == data[newOne].start_time &&
							dealLocal.requester == data[newOne].requester_house_id &&
							dealLocal.responder == data[newOne].responder_house_id){
					 //if(dealLocal.equals(data[newOne])==true) {
							dealLocal.exists=true;
							dealLocal.isMasterDeal = data[newOne].is_master_deal;
							isNew=false;
					 }*/
				}
				if(isNew){
					 //console.log("Add deal");
					 var d = new Deal(data[newOne]);
					 dealsViz.push( d);
				}
			 }
	 }
	 for( var id in dealsViz){
			if(dealsViz[id].exists == false){
				 //no response in the last minute
				 dealsViz.splice(id,1);
			}
	 }
}

