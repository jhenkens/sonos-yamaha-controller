#!/usr/bin/env node
'use strict';
/**
 * Require dependencies
 *
 */
const program = require('commander'),
    chalk = require("chalk"),
    sonos = require("sonos"),
    config = require('./config/config.json'),
    exec = require('child_process').exec,
    pkg = require('./package.json'),
    device = require('./device'),
    runner = require('./runner');

let search = () => {
    console.log('Searching for Sonos devices...');
    var search = sonos.search()
    search.on('DeviceAvailable', function (device, model) {
      console.log(device, model)
      device.getCurrentState(function (err, track) {
          console.log(err, track)
        })
    })

    // Optionally stop searching and destroy after some time
    setTimeout(function () {
      console.log('Stop searching for Sonos devices')
      search.destroy()
    }, 30000)
}
/**
 * list function definition
 *
 */
let main = (options) => {
    runner.start()
};


program
    .version(pkg.version)
    .command('search')
    .description('Search and print info on the target zone')
    .action(() =>{ device.find(config.search_zone, (host) => {console.log(JSON.stringify(host))}, 2500)});

program
    .version(pkg.version)
    .command('start')
    .description('Start the tool')
    .action(main);

program
    .version(pkg.version)
    .command('helloworld')
    .description('hi there!')
    .option('-s, --short','make it short!')
    .action((options) => {
        if(options.short){console.log('hi world;')} else {console.log('helloworld')}
    });

program.parse(process.argv);

// if program was called with no arguments, show help.
if (program.args.length === 0) program.help();
