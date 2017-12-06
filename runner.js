#!/usr/bin/env node
'use strict';
var _ = require('underscore')
var sonos = require('sonos'),
    device = require('./device'),
    config = require('./config/config.json'),
    cron = require('node-cron'),
    datediff = require('date-diff');



module.exports = {
  start: start
}

let state = {
    host: null,
    last_playing: null,
    last_stopped: null,
    currently_playing: false,
    last_turned_yamaha_on: null,
    last_turned_yamaha_off: null
}
function start(){
    updateHost(() => checkIfPlaying(updateStatus));

    cron.schedule(config.host_update_cron, () => {
        updateHost();
    });
    cron.schedule(config.check_cron, () => {
        checkIfPlaying(updateStatus);
    });
}

let updateHost = (callback) => {
    if(config.fallback_ip){
        updateHostByIp(config.fallback_ip, callback)
    } else{
        device.find(config.search_zone,
            (device) => {
                updateHostByIp(device.ip, callback)
            }
        );
    }
}

let updateHostByIp = (ip_address, callback) => {
    state.host = new sonos.Sonos(ip_address);
    if(callback) callback(state.host);
}

let checkIfPlaying = (callback) => {
    state.host.getCurrentState((err, track) => {
        if(track == 'playing'){
            state.last_playing = new Date()
            state.currently_playing = true;
            if(callback) callback()
        } else if (track){
            state.last_stopped = new Date()
            state.currently_playing = false;
            if(callback) callback()
        }
    });
}

let updateStatus = (playing) => {
    if(!state.currently_playing && state.last_playing != null){
        var alreadyTurnedYamahaOff = (new datediff(state.last_playing, state.last_turned_yamaha_off)) < 0;
        var minutes_since_last_playing = (new datediff(new Date(), state.last_playing)).minutes()
        console.log(minutes_since_last_playing)
        if(minutes_since_last_playing > config.wait_before_poweroff_in_minutes){
            turnYamhaOff();
        }
    } else if (state.currently_playing){
        var shouldTurnOn = !state.last_turned_yamaha_on ||
             (new datediff(state.last_stopped, state.last_turned_yamaha_on)).seconds() > 0;
        turnYamhaOn();
    }
}

let turnYamhaOff = () =>{
    state.last_turned_yamaha_off = new Date();
    //Would be nice to query harmony here to see if we can restore the proper activity setting
    console.log("poweroff")
}
let turnYamhaOn = () =>{
    state.last_turned_yamaha_on = new Date();
    //Check if on, if not, set power and wait.
    //Check if input correct, if not, set input and wait
    //Check sound settings correct, if not, set settings
    console.log("poweron")
}
