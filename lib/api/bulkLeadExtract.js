var _ = require('lodash'),
  Promise = require('bluebird'),
  util = require('../util'),
  Retry = require('../retry'),
  MarketoStream = require('../stream'),
  log = util.logger();

function BulkLeadExtract(marketo, connection) {
  this._marketo = marketo;
  this._connection = connection;
  this._retry = new Retry({ maxRetries: 10, initialDelay: 30000, maxDelay: 60000 });
}

BulkLeadExtract.prototype = {
  create: function (fields, filter, options) {
    if (!_.isArray(fields)) {
      var msg = 'fields needs to be an Array';
      log.error(msg);
      return Promise.reject(msg);
    }
    var path = util.createBulkPath('leads', 'export', 'create.json');
    options = _.extend({}, options, {
      fields: fields,
      filter: filter,
    });
    return this._connection.postJson(path, options, { _method: 'POST' });
  },
  enqueue: function (exportId, options) {
    var path = util.createBulkPath('leads', 'export', exportId, 'enqueue.json');
    options = _.extend({}, options, {
      _method: 'POST'
    });
    return this._connection.post(path, { data: options });
  },
  status: function (exportId, options) {
    var path = util.createBulkPath('leads', 'export', exportId, 'status.json');
    options = _.extend({}, options, {
      _method: 'GET'
    });
    return this._connection.get(path, { data: options });
  },
  statusTilCompleted: function (exportId, options) {
    var defer = Promise.defer();
    var requestFn = function () {
      this.status(exportId).then(function (data) {
        if (!data.success) {
          var msg = data.errors[0].message;
          log.error(msg);
          return defer.reject(msg);
        }
        console.log('STATUS: ' + data.result[0].status);
        if (data.result[0].status == 'Queued' || data.result[0].status == 'Processing') {
          return defer.reject({
            requestId: data.requestId,
            errors: [{ code: '606' }]
          });
        }
        defer.resolve(data);
      }).catch(defer.reject);
      return defer.promise;
    };
    return this._retry.start(requestFn, this);
  },
  cancel: function (exportId, options) {
    var path = util.createBulkPath('leads', 'export', exportId, 'cancel.json');
    options = _.extend({}, options, {
      _method: 'POST'
    });
    return this._connection.post(path, { data: options });
  },
  get: function (fields, filter, options) {
    var self = this, defer = Promise.defer();
    this.create(fields, filter, options).then(function (data) {
      if (!data.success) {
        var msg = data.errors[0].message;
        log.error(msg);
        return defer.reject(msg);
      }
      let exportId = data.result[0].exportId;
      self.enqueue(exportId).then(function (data) {
        if (!data.success) {
          var msg = data.errors[0].message;
          log.error(msg);
          return defer.reject(msg);
        }
        self.statusTilCompleted(exportId)
          .then(defer.resolve)
          .catch(defer.reject);
      }).catch(function (err) {
        self.cancel(exportId).then(function (data) {
          return defer.reject(err);
        }).catch(defer.reject);
      });
    }).catch(defer.reject);
    return defer.promise;
  },
  // FILE
  file: function (exportId, options) {
    var path = util.createBulkPath('leads', 'export', exportId, 'file.json');
    options = _.extend({}, options, {
      _method: 'GET'
    });
    return this._connection.get(path, { data: options });
  },
  fileStream: function (exportId, options) {
    return new MarketoStream(this.file(exportId, options).then(function (data) {
      return { result: [data] };
    }));
  },
};

module.exports = BulkLeadExtract;