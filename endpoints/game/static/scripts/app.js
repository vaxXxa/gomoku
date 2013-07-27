$(function() {

// Create app object for isolated scope/namespace.
window.app = {
	el: $("#app"),
	view: {},
	currentView: null,
	socket: null,
	channel: {},

	init: function() {
		var sock_url = '/socket';
		this.sock = new SockJS(sock_url);

		var multiplexer = new WebSocketMultiplex(this.sock);

		this.channel.usernameChoiceSock = multiplexer.channel('username_choice');
		this.channel.gamesListSock = multiplexer.channel('games_list');
		this.channel.gamesJoinSock = multiplexer.channel('games_join');
		this.channel.gameCreateSock = multiplexer.channel('game_create');
		this.channel.statsSock = multiplexer.channel('stats');
		this.channel.noteSock = multiplexer.channel('note');
		this.channel.gameActionSock = multiplexer.channel('game_action');

		app.view.stats.init();
		app.goto("nickname");
	},

	goto: function(view, model) {
		if ((this.currentView !== null) && (this.currentView.empty != "undefined")) {
			app.view[this.currentView].empty();
			app.view.error.empty();
		}

		this.currentView = view;
		app.view[view].init(model);
	}
};


// Stats view.
app.view.stats = {
	el: $("#stats"),
	templates: {
		"main": $("#tpl-stats").html(),
		"list": $("#tpl-stats-data").html()
	},
	model: [],

	init: function() {
		var self = this;
		this.render();
	},

	events: function() {
		var self = this;

		app.channel.statsSock.onmessage = function(evt) {
			obj = $.parseJSON(evt.data);
			self.updateModel(obj);
		};

		$('#stats-toggle').click(function() {
			var clicks = $(this).data('clicks');
			if (clicks) {
				$('#stats-data').css("height", "0");
			} else {
				$('#stats-data').css("height", "auto");
				$('#stats-data').css("overflow-y", "visible");
			}
			$(this).data("clicks", !clicks);
		});

		// Esc stats binding.
		$(document).keyup(function(e) {
			if(e.keyCode == 27) {
				$('#stats-toggle').click();
			}
		});
	},

	render: function() {
		this.el.html(Mustache.render(this.templates["main"], {}));
		this.renderList();
		this.events();
	},

	renderList: function() {
		var context;

		if (this.model.length) {
			context = {
				"data": {
					loop: this.model
				}
			};
		} else {
			context = {
				"data": this.model
			};
		}

		$('#stats-data').html(Mustache.render(this.templates["list"], context));
	},

	updateModel: function(model) {
		this.model = model || this.model;
		this.renderList();
	},

	empty: function() {
		this.el.empty();
	}
};

// Error view.
app.view.error = {
	el: $("#error"),
	template: $("#tpl-error").html(),
	model: [],

	init: function(model) {
		this.model = model || this.model;
		this.render();
	},

	render: function() {
		if (!this.model.length) {
			return;
		}
		this.el.html(Mustache.render(this.template, this.model));
	},

	empty: function() {
		this.el.empty();
	}
};

// Nickname view.
app.view.nickname = {
	el: $("#nickname"),
	template: $("#tpl-nickname").html(),

	init: function() {
		this.render();
	},

	events: function() {
		var self = this;

		app.channel.usernameChoiceSock.onmessage = function(evt) {
			obj = $.parseJSON(evt.data);
			if (obj.status == 'ok'){
				app.secret = obj.secret;
				app.username = obj.username;
				app.goto("games");
			}
			else {
				app.view.error.init(obj.errors);
			}
		};

		$("#nickname-username").keyup(function(e) {
			if (e.keyCode == 13) {
				app.channel.usernameChoiceSock.send(
					JSON.stringify(self.serialize())
				);
			}
		});
	},

	render: function() {
		this.el.html(Mustache.render(this.template, {}));
		this.events();
	},

	serialize: function() {
		var username = $('#nickname-username').val();
		return {
			"username": username
		};
	},

	empty: function() {
		this.el.empty();
	}
};

// Games view.
app.view.games = {
	el: $("#games"),
	templates: {
		"main": $("#tpl-games").html(),
		"list": $("#tpl-games-choose-container").html()
	},
	model: [],

	init: function(model) {
		this.model = model || this.model;
		this.render();

		if (model !== undefined) {
			this.updateModel(model);
		} else {
			app.channel.gamesListSock.send(
				JSON.stringify(
					{"secret": app.secret}
				)
			);
		}
	},

	events: function() {
		var self = this;

		app.channel.gamesListSock.onmessage = function(evt) {
			obj = $.parseJSON(evt.data);
			if (obj.status == 'ok'){
				self.updateModel(obj.games);
			}
			else {
				app.view.error.init(obj.errors);
			}
		};

		app.channel.gamesJoinSock.onmessage = function(evt) {
			obj = $.parseJSON(evt.data);
			if (obj.status == 'ok'){
				app.goto('game', obj.model);
			}
			else {
				app.view.error.init(obj.errors);
			}
		};

		$('#games-join').click(function() {
			app.channel.gamesJoinSock.send(
				JSON.stringify(self.serialize())
			);
		});

		$('#games-create').click(function() {
			app.goto("details");
		});
	},

	render: function() {
		this.el.html(Mustache.render(this.templates["main"], {}));
		this.renderList();
		this.events();
	},

	renderList: function() {
		var context;

		if (this.model.length) {
			context = {
				"data": {
					loop: this.model
				}
			};
		} else {
			context = {
				"data": this.model
			};
		}

		$('#games-choose-container').html(Mustache.render(this.templates["list"], context));
	},

	serialize: function() {
		return {
			"secret": app.secret,
			"id": +$('#games-choose').val()
		};
	},

	updateModel: function(model) {
		this.model = model || this.model;
		this.renderList();
	},

	empty: function() {
		this.el.empty();
	}
};

// Detials view.
app.view.details = {
	el: $("#details"),
	template: $("#tpl-details").html(),

	init: function() {
		this.render();
	},

	events: function() {
		var self = this;

		app.channel.gameCreateSock.onmessage = function(evt) {
			obj = $.parseJSON(evt.data);
			if (obj.status == 'ok'){
				app.goto('game', obj.model);
			}
			else {
				app.view.error.init(obj.errors);
			}
		};

		$('#details-create').click(function() {
			app.channel.gameCreateSock.send(
				JSON.stringify(self.serialize())
			);
		});

		$("#details-dimensions, #details-lineup").keyup(function(e) {
			if (e.keyCode == 13) {
				$("#details-create").click();
			}
		});
	},

	render: function() {
		this.el.html(Mustache.render(this.template, {}));
		this.events();
	},

	serialize: function() {
		return {
			"secret": app.secret,
			"dimensions": $('#details-dimensions').val(),
			"lineup": $('#details-lineup').val(),
			"color": $('#details-color').val()
		};
	},

	empty: function() {
		this.el.empty();
	}
};

// Game view.
app.view.game = {
	el: $("#game"),
	template: $("#tpl-game").html(),
	model: {},

	init: function(model) {
		this.model = model || this.model;
		this.render();
	},

	events: function() {
		var self = this;

		app.channel.noteSock.onmessage = function(evt) {
			obj = $.parseJSON(evt.data);
			self.renderNote(obj.msg);
		};

		app.channel.gameActionSock.onmessage = function(evt) {
			obj = $.parseJSON(evt.data);
			if (obj.status == 'ok'){
				stone = {"x": "2", "y": "2", "color": "white"};
				self.putStone(stone);
			}
			else {
				self.renderNote(obj.errors.join(', '));
			}
		};

		var resizeTimerID;
		$(window).resize(function() {
			clearTimeout(resizeTimerID);
			resizeTimerID = setTimeout(self.setCellSize, 100);
		});

		$('[data-coordinates]:not([class])').click(function() {
			app.channel.gameActionSock.send(
				JSON.stringify({
					'secret': app.secret,
					'gameid': 100,
					'x': 3,
					'y': 3
				})
			);
		});
	},

	render: function() {
		var cells = [];
		for(var y = 1; y <= this.model.dimensions; y++) {
			for(var x = 1; x <= this.model.dimensions; x++) {
				cells.push(x + ":" + y);
			}
		}

		this.el.html(Mustache.render(this.template, cells));

		for(var i = 0; i < this.model.cells.length; i++) {
			var cell = this.model.cells[i];
			this.putStone(cell);
		}

		this.setCellSize();
		this.events();
	},

	setCellSize: function() {
		// hack: redefine context (setTimeout set its own)
		var self = app.view.game;

		var width = $("#game-field").closest(".page").width();
		var size = Math.floor(width / self.model.dimensions);
		$("#game-field").width(size * self.model.dimensions);
		$('[data-coordinates]').css({
			"width": size,
			"height": size
		});
	},

	putStone: function(stone) {
		$('[data-coordinates="'+ stone.x + ":" + stone.y +'"]').addClass(stone.color);
	},

	renderNote: function(text) {
		$('#game-note').html(text);
	},

	serialize: function(elem) {
		var coordinates = $(elem).attr("data-coordinates").split(":");
		return {
			"x": coordinates[0],
			"y": coordinates[1]
		};
	},

	empty: function() {
		this.el.empty();
	}
};


// Initialize app.
app.init();

});