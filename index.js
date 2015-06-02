var moment = require('moment');
var cmd = require('commander');
var fs = require('fs');
var out = require('stream');
var readline = require('readline');
var _ = require('underscore');

cmd
  .version('0.0.1')
  .usage('<directory>')
  .parse(process.argv);

if (cmd.args.length != 1) {
  console.log('Please specify exactly one directory');
  process.exit()
}

//Adapt the filter when you change ELB
elb_log_files = _.filter(fs.readdirSync(cmd.args[0]), function(file) {
  return /.*_elasticloadbalancing_.*\.log$/gi.test(file)
});

if (elb_log_files.length <= 0) {
  console.log('no log files found');
  process.exit();
}

var RESP_ELB = 7
var RESP_BACKEEND = 8
var REQ = 11
var DATE = 0
var collect = {};
var refDate = '2015-05-26T18:50:15.208009Z'

var treatFile = function(index, endCB) {
  var filename = cmd.args[0] + elb_log_files[index];
  console.log('Aggregating file ' + filename + ' (' + (index+1) + ')');
  var reader = fs.createReadStream(filename);
  var rl = readline.createInterface(reader, out);

  rl.on('line', function(line) {
    var reqsplit = line.split('"');
    var entries = reqsplit[0].split(' ');
    var datestring = entries[0];
    if (datestring.length !== refDate.length) {
      console.log('wrong date detected: ' + datestring);
      return;
    }
    var date = moment(entries[0], 'YYYY-MM-DDTHH:mm:ss.SSSZ');
    //Our key is seconds as we aggregate per second
    var key = date.format('YYYYMMDDHHmmss');
    if (key.indexOf('I') > -1 ||
        key.indexOf('-') > -1 ||
        key.indexOf('2015') != 0) {
      console.log('invalid date detected: ' + datestring);
      return;
    }
    if (collect[key] === undefined) {
      collect[key] = {
        key: key,
        count200: 0,
        count504: 0,
        countOther: 0,
        ba200: 0,
        ba504: 0,
        ba0: 0,
        baOther: 0,
        wmts: 0,
        api3: 0,
        wms: 0,
        mapproxy: 0,
        other: 0,
        total: 0,
        v1: 0,
        v2: 0,
        vx: 0,
        reqtime: 0,
        backtime: 0,
        resptime: 0,
        timeerr: 0,
        all500: 0,
        longreq: 0
      }
    }
    var col = collect[key];
    col.total += 1;

    if (entries[4] == '-1' ||
        entries[5] == '-1' ||
        entries[5] == '-1') {
      col.timeerr += 1;
    } else {
      req = parseFloat(entries[4]);
      back = parseFloat(entries[5]);
      resp = parseFloat(entries[6]);
      if (isNaN(req) ||
          isNaN(back) ||
          isNaN(resp)) {
        col.timeerr += 1;
      } else {
        col.reqtime += req;
        col.backtime += back;
        col.resptime += resp;
      }
    }
  
    //Varnishes. Hardcoded IP adresses
    if (/10\.220\.6\.61:80/gi.test(entries[3])) {
      col.v1 += 1;
    } else if (/10\.220\.5\.136:80/gi.test(entries[3])) {
      col.v2 += 1;
    } else {
      col.vx += 1;
    }


    if (reqsplit[1].length > 8192) {
      col.longreq += 1;
    }

    //Services. Hardcoded as well
    if (/:\/\/wmts[5|6|7|8|9]?/gi.test(reqsplit[1])) {
      col.wmts += 1;
    } else if (/:\/\/wmts(10|11|12|13|14)/gi.test(reqsplit[1])) {
      col.mapproxy += 1;
    } else if (/:\/\/api3/gi.test(reqsplit[1])) {
      col.api3 += 1;
    } else if (/:\/\/wms/gi.test(reqsplit[1])) {
      col.wms += 1;
    } else {
      col.other += 1;
    }

    // ELB return codes
    if (/504/gi.test(entries[RESP_ELB])) {
      col.count504 += 1;
    } else if (/200/gi.test(entries[RESP_ELB])) {
      col.count200 += 1;
    } else {
      col.countOther += 1;
    }
    if (/^5/gi.test(entries[RESP_ELB])) {
      col.all500 += 1;
    }

    // Backend return codes
    if (/504/gi.test(entries[RESP_BACKEEND])) {
      col.ba504 += 1;
    } else if (/200/gi.test(entries[RESP_BACKEEND])) {
      col.ba200 += 1;
    } else if (/0/gi.test(entries[RESP_BACKEEND])) {
      col.ba0 += 1;
    } else {
      col.baOther += 1;
    }
  });

  rl.on('close', function() {
    endCB();
  });

}

current = -1;
var next = function() {
  current += 1;
  if (current < elb_log_files.length) {
    treatFile(current, next);
  } else {
    for (var prop in collect) {
      c = collect[prop];
      if (c.total == 0 ||
          c.total - c.timeerr == 0) {
        c.reqtime = 0;
        c.backtime = 0;
        c.resptime = 0;
      } else {
        c.reqtime = c.reqtime / (c.total - c.timeerr)
        c.backtime = c.reqtime / (c.total - c.timeerr)
        c.resptime = c.reqtime / (c.total - c.timeerr)
      }
      out = '';
      for (var val in c) {
        out += c[val] + ' '
      }
      console.log(out);
    }
  }
}
console.log('Total files found: ' + elb_log_files.length);
next();
