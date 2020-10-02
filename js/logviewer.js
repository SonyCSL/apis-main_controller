			$(function(){
				if (!window.WebSocket) {
					if (window.MozWebSocket) {
						window.WebSocket = window.MozWebSocket;
					} else {
						alert('Your browser doesn\'t support WebSockets.');
					}
				}
				
				var ws = new WebSocket('ws://localhost:4382/ws');
				ws.onmessage = function(evt) {
					$('#chat').val($('#chat').val() + '\n' + evt.data);
				};
				ws.onopen = function(){console.log("Socket opened");};
				ws.onclose = function(evt) {
					$('#message').attr('disabled', 'disabled');
					$('#send').attr('disabled', 'disabled');
				};

				$('#send').click(function(){
					ws.send($('#message').val());
					$('#message').val('');
				});
			});