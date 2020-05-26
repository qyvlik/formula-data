'use strict';

require('dotenv').config();

const ccxt = require('ccxt');
const fetch = require('node-fetch');
const schedule = require('node-schedule');
const HttpsProxyAgent = require('https-proxy-agent');

function requestMethod(url, options) {
    if (process.env['ENABLE_HTTP_PROXY'] === 'true') {
        const proxy = process.env['MY_HTTP_PROXY'] || "http://127.0.0.1:1087";
        const agent = new HttpsProxyAgent(proxy);
        return fetch(url, Object.assign({}, options, {agent: agent}));
    } else {
        return fetch(url, Object.assign({}, options, {}));
    }
}

let ccxtMap = {};
for (let exIndex in ccxt.exchanges) {
    let exName = ccxt.exchanges[exIndex];
    if (exName === 'theocean') {
        continue
    }
    try {
        ccxtMap[exName] = new ccxt[exName]({
            fetchImplementation: requestMethod
        });
    } catch (e) {
        console.error(`create ${exName} failure : ${e.message}`)
    }
}

function updateVarsIntoFormula(variables) {
    const formula_host = process.env['FORMULA_HOST'];
    if (!formula_host) {
        console.error("updateVarIntoFormula failure : env `FORMULA_HOST` not exist");
        return;
    }

    const formula_token = process.env['FORMULA_TOKEN'];
    if (!formula_token) {
        console.error("updateVarIntoFormula failure : env `FORMULA_TOKEN` not exist");
        return;
    }

    let body = {variables: variables};

    const url = formula_host + "/api/v1/formula/variables/update";

    fetch(url, {
        method: 'post',
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
            'token': formula_token
        },
    }).catch((error) => {
        console.error(`updateVarIntoFormula failure host:${formula_host}, error:${error.message}`);
    });
}

function updateVarIntoFormula(name, value, timestamp, timeout) {
    updateVarsIntoFormula([{
        'name': name,
        'value': value,
        'timestamp': timestamp,
        'timeout': timeout
    }]);
}

function fetchFiatRate() {
    // See [qyvlik/fiat-exchange-rates](https://github.com/qyvlik/fiat-exchange-rates)
    const fiat_rate_host = process.env['FIAT_RATE_HOST'];
    if (!fiat_rate_host) {
        console.error("updateVarIntoFormula failure : env `FIAT_RATE_HOST` not exist");
        return;
    }
    const url = fiat_rate_host + "/api/v1/pub/rate/rates";
    const timeout = process.env['FIAT_TIMEOUT'] || 4 * 60 * 60 * 1000;              // 4 hour

    fetch(url)
        .then((result) => result.json())
        .then((json) => {
            let rateMap = {};
            let rateResultArray = json['result'];
            rateResultArray.forEach((rate) => {
                let key = rate['base'].toLowerCase() + '_in_' + rate['quote'].toLowerCase();
                let oldRate = rateMap[key];
                if (!oldRate || oldRate['ts'] < rate['ts']) {
                    rateMap[key] = rate;
                }
            });

            let variables = [];
            Object.keys(rateMap).forEach((key) => {
                let rate = rateMap[key];
                variables.push({
                    'name': key,
                    'value': rate['rate'],
                    'timestamp': rate['ts'],
                    'timeout': timeout
                })
            });

            updateVarsIntoFormula(variables);
        })
        .catch((error) => {
            console.error(`fetchFiatRate failure host:${fiat_rate_host}, error:${error.message}`);
        });
}

function fetch_job() {
    const fetch_tickers = require('./fetch-config.json');
    const cron = process.env['CRON_EXPRESSION'] || '0/3 * * * * ?';
    const timeout = process.env['FORMULA_TIMEOUT'] || 5 * 60 * 1000;              // unit is ms

    function fetch_ticker() {
        Object.keys(fetch_tickers.exchanges).forEach((exName) => {
            let tickers = fetch_tickers.exchanges[exName];

            tickers.forEach((ticker) => {
                const startTime = Date.now();
                ccxtMap[exName]
                    .fetchTicker(ticker)
                    .then((result) => {
                        const timestamp = Date.now();

                        const value = result['last'];
                        if (value) {

                            console.debug(`fetchTicker ex: ${exName}, ${ticker} cost:${timestamp - startTime}ms, value:${value}`);

                            const tickerArray = ticker.toLowerCase().split('/');
                            const name = exName + '_' + tickerArray[0] + "_" + tickerArray[1];
                            updateVarIntoFormula(name, value, timestamp, timeout);
                        }
                    })
                    .catch((error) => {
                        console.error(`fetchTicker error : ex: ${exName}, ticker:${ticker}, result:${error.message}`);
                    })
            });
        })
    }

    schedule.scheduleJob(cron, () => {
        fetch_ticker();

        fetchFiatRate();
    });
}

fetch_job();

