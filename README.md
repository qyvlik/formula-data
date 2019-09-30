# formula-data

Fetch crypto-currency ticker and foreign exchange rates,
and upload into [qyvlik/formula](https://github.com/qyvlik/formula).

## startup

1. Copy the `.env.example` as `.env` file
2. set the variable such as follow

```dotenv
# enable use http proxy
ENABLE_HTTP_PROXY=true
MY_HTTP_PROXY=http://127.0.0.1:1087

# job cron experession, default interval is 3 seconds 
CRON_EXPRESSION=0/3 * * * * ?

# formula host, see https://github.com/qyvlik/formula
FORMULA_HOST=http://127.0.0.1:8120
FORMULA_TOKEN=ad82c6ae-f7a3-486b-b933-aa19104d8142
FORMULA_TIMEOUT=300000

# foreign exchange rates, see https://github.com/qyvlik/fiat-exchange-rates
FIAT_RATE_HOST=http://127.0.0.1:8080
FIAT_TIMEOUT=14400000
```

3. Copy the `fetch-config.json.example` as `fetch-config.json`
4. Set the exchange name and market which you want fetch

```json
{
  "exchanges":{
    "upbit": [
      "BTC/KRW", "BCH/KRW", "ETH/KRW", "EOS/KRW", "XRP/KRW"
    ],
    "okex3": [
      "BTC/USDT", "BCH/USDT", "ETH/USDT", "EOS/USDT", "XRP/USDT"
    ],
    "binance": [
      "BTC/USDT", "BCH/USDT", "ETH/USDT", "EOS/USDT", "XRP/USDT"
    ],
    "huobipro": [
      "USDT/HUSD", "BTC/USDT", "BCH/USDT", "ETH/USDT", "EOS/USDT", "XRP/USDT"
    ]
  }
}
```

## npm install

```bash
npm install --registry=https://registry.npm.taobao.org
```

## formula

See [qyvlik/formula](https://github.com/qyvlik/formula)

## ccxt

See [ccxt/ccxt](https://github.com/ccxt/ccxt)

## foreign-exchange-rates

See [qyvlik/fiat-exchange-rates](https://github.com/qyvlik/fiat-exchange-rates)
