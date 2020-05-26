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

const fetchConfig = require('./fetch-config.json');

async function updateVarsIntoFormula(variables) {
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

    return await fetch(url, {
        method: 'post',
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
            'token': formula_token
        },
    })
}

function updateVarIntoFormula(name, value, timestamp, timeout) {
    updateVarsIntoFormula([{
        'name': name,
        'value': value,
        'timestamp': timestamp,
        'timeout': timeout
    }]);
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
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

function fetch_tickers() {
    const timeout = process.env['FORMULA_TIMEOUT'] || 5 * 60 * 1000;              // unit is ms

    Object.keys(ccxtMap).forEach(async (exName) => {

        if (!fetchConfig.exchanges.includes(exName)) {
            return;
        }

        let exObj = ccxtMap[exName];

        if (typeof exObj === 'undefined') {
            return;
        }

        let marketMap = await exObj.loadMarkets(true);

        let tickers = {};
        if (exObj.has["fetchTickers"]) {
            try {
                console.debug(`${exName} fetchTickers`);
                tickers = await exObj.fetchTickers();
            } catch (error) {
                console.error(`${exName} fetchTickers failure : ${error.message}`);
            }
        } else {
            let marketList = await exObj.fetchMarkets();
            await asyncForEach(marketList, async (market) => {
                try {
                    console.debug(`${exName} fetchTicker ${market.symbol}`);
                    tickers[market.symbol] = await exObj.fetchTicker(market.symbol);
                } catch (error) {
                    console.error(`${exName} fetchTicker ${market.symbol} failure : ${error.message}`);
                }
            });
        }

        let vars = [];
        Object.keys(tickers).forEach((key) => {
            let ticker = tickers[key];
            let symbol = ticker.symbol;
            let marketInfo = marketMap[symbol];
            if (marketInfo && marketInfo.spot) {
                let symbolArray = ticker.symbol.split("/");
                const name = exName + '_' + symbolArray[0] + "_" + symbolArray[1];
                let last = ticker['last'];
                if (last) {
                    vars.push({
                        'name': name,
                        'value': ticker['last'],
                        'timestamp': Date.now(),
                        'timeout': timeout
                    })
                }
            }
        });

        try {
            await updateVarsIntoFormula(vars);
        } catch (error) {
            console.error(`${exName} updateVarsIntoFormula failure: ${error.message}`);
        }
    });
}

function fetch_job() {
    const cron = process.env['CRON_EXPRESSION'] || '0/3 * * * * ?';
    schedule.scheduleJob(cron, () => {
        fetch_tickers();

        // fetchFiatRate();
    });
}


(async () => {
    fetch_job();

    // init when startup
    fetch_tickers();
})();

