#!/usr/bin/env node
'use strict';
var _ = require('underscore')
var sonos = require('sonos')


module.exports = {
  find: find
}

function collect_device_data(device, model, callback) {
  var data = {ip: device.host, port: device.port, model: model}
  device.getZoneAttrs(function (err, attrs) {
    if (!err) {
      _.extend(data, attrs)
    }
    device.getZoneInfo(function (err, info) {
      if (!err) {
        _.extend(data, info)
      }
      device.getTopology(function (err, info) {
        if (!err) {
          info.zones.forEach(function (group) {
            if (group.location === 'http://' + data.ip + ':' + data.port + '/xml/device_description.xml') {
              _.extend(data, group)
            }
          })
        }
        callback(data)
      })
    })
  })
}

function find(target, callback, timeout = 2000 ) {
     sonos.search({timeout: timeout}, function (device, model) {
         collect_device_data(device, model,
             (device) => {
                 if(device.coordinator && device.CurrentZoneName == target){
                     callback(device)
                 }
             })
     })
 }
