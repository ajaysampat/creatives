/*jshint strict:false*/
/*global CasperError, console, phantom, require*/

var casper = require("casper").create({
    viewportSize: {
        width: 1600,
        height: 768
    },
    logLevel: "debug",
    verbose: true,
    waitTimeout: 20000
});

//login
casper.start('https://app.singular.net/login', function login() {
    this.fillSelectors('form.registration-form', {
        'input#login-email': casper.cli.get("email"),
        'input#login-password': casper.cli.get("pass"),
    }, false);
    this.clickLabel('Login', 'button');
});

casper.waitForUrl('https://app.singular.net/#/dashboard');
casper.thenOpen('https://www.singular.net/#/creatives');

//set date range
casper.waitForSelector('#datepicker-apply-button', function setDateRange() {
    this.evaluate(function() {
        //yesterday
        var to = new Date();
        to.setDate(to.getDate() - 2);
        //30 days ago from yesterday
        var from = new Date(to - 30*24*3600*1000);
        var dates = new Array(Date.parse(from), Date.parse(to));
        $('#datepicker-calendar').DatePickerSetDate(dates, true);
    });
    this.click('#datepicker-apply-button');
});

//capture VC Android Screen
casper.waitWhileSelector('.ajaxFancy', function() {
    content = casper.evaluate(function() {
        $('.summary-tiny-icon').remove();
        return $('#creatives').html();
    });
    if (this.exists('#creatives')) {
        var fs = require('fs');
        fs.write("creatives-vc-android.txt", content, 'w');
    } else {
        this.echo('no creatives div');
    }
});
//change to VC iOS
casper.wait(1000, function() {
    this.evaluate(function() {
        document.querySelector('#reportSelect').selectedIndex = 1;
    });
    this.click('#reportGoBtn');
});
//capture VC iOS Screen
casper.waitWhileSelector('.ajaxFancy', function() {
    content = casper.evaluate(function() {
        $('.summary-tiny-icon').remove();
        return $('#creatives').html();
    });
    if (this.exists('#creatives')) {
        var fs = require('fs');
        fs.write("creatives-vc-ios.txt", content, 'w');
    } else {
        this.echo('no creatives div');
    }
});
//change to WC:RA
casper.wait(1000, function() {
    this.evaluate(function() {
        document.querySelector('#reportSelect').selectedIndex = 2;
    });
    this.click('#reportGoBtn');
});
//capture WCRA Screen
casper.waitWhileSelector('.ajaxFancy', function() {
    content = casper.evaluate(function() {
        $('.summary-tiny-icon').remove();
        return $('#creatives').html();
    });
    if (this.exists('#creatives')) {
        var fs = require('fs');
        fs.write("creatives-wcra.txt", content, 'w');
    } else {
        this.echo('no creatives div');
    }
});


casper.run();

