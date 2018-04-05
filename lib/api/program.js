var _ = require('lodash'),
    Promise = require('bluebird'),
    util = require('../util'),
    log = util.logger();

function Program(marketo, connection) {
  this._marketo = marketo;
  this._connection = connection;
}

Program.prototype = {
  request: function(programId, leads, tokens, options) {
    if (!_.isArray(leads)) {
      var msg = 'leads needs to be an Array';
      log.error(msg);
      return Promise.reject(msg);
    }

    options = _.extend({}, options, {
      input: { leads: leads, tokens: tokens },
      _method: 'POST'
    });
    options = util.formatOptions(options);

    return this._connection.post(util.createPath('programs',programId,'trigger.json'), 
	{data: JSON.stringify(options), headers: {'Content-Type': 'application/json'}});
  },
  getPrograms: function(options) {
    var path = util.createPath( 'programs.json' );
    options = _.extend({}, options, {
      _method: 'GET'
    });
    return this._connection.get(path, {data: options});
  },

};

module.exports = Program;
