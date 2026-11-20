# selcall-web

A static web app for an Android phone that plays CCIR 493-4 HF Selcall ("Open
Selcall") individual calls. You hold the phone to the microphone of an SSB rig
to call a station such as an Icom IC-F8101.

## Using it

1. Tune the calling rig to the called station's channel, in USB.
2. Enter the destination ID and your own ID (4 or 6 digits).
3. Key the rig, press **Call**, and hold PTT until it reports "Done".

Use the 6 s preamble when the called radio is scanning, and 1 s when it is already
sitting on the channel.

## Signal

- FSK, 100 baud, bit 0 = 1700 Hz, bit 1 = 1870 Hz (audio, USB)
- Dot-pattern preamble, then phasing (DX 125 / RX 109..104), then the message
  `120, <to>, 100, <from>, 117` with DX/RX time diversity
- Each symbol is 7 data bits sent LSB first, plus a 3-bit count of zeros sent MSB first

The frame follows Mark Jessop's reverse-engineered implementation
([alltheFSKs/CCIR493-4.py](https://github.com/darksidelemm/alltheFSKs/blob/master/CCIR493-4.py)),
which is confirmed to ring Codan and Barrett radios with 4-digit IDs. The 6-digit
addressing and the IC-F8101 behaviour are **not yet verified**.

## Development

No build step: plain ES modules.

```bash
npm test
```

```bash
python -m http.server 8000
```

Service workers need HTTPS or localhost. To test on the phone, use the GitHub
Pages URL or `adb reverse tcp:8000 tcp:8000`.

The deploy workflow stamps `VERSION` in `sw.js` with the commit SHA, so every
deploy gets a fresh offline cache. The cache is served first, so an installed
copy fetches the update in the background on one launch with a connection and
shows it on the launch after that.

`test/site.test.js` checks that every file the page loads is both in the
service worker's `FILES` list and copied by the deploy workflow.

## Deploy

GitHub Pages via `.github/workflows/pages.yml`. Enable it with
*Settings > Pages > Source: GitHub Actions*.

## Roadmap

- Verify against a real IC-F8101 (4- and 6-digit IDs)
- Reference captures in `test/fixtures/`
- Icom Selcall flavour (needs a capture)
