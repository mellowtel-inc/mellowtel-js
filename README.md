![Mellowtel cover](docs/images/header.png)

<div align="center"><strong>Mellowtel</strong></div>
<div align="center">Monetize your Chrome Extensions.<br />Open-Source, Consensual, Transparent.</div>
<br />
<div align="center">
<a href="https://www.mellowtel.it/">Website</a>
<span> · </span>
<a href="https://github.com/mellowtel-inc/mellowtel-js">GitHub</a>
<span> · </span>
<a href="https://discord.gg/GC8vwpDWC9">Discord</a>
<span> · </span>
<a href="https://docs.mellowtel.it/get-started/quickstart">Documentation</a>
</div>

<br/>

<div class="title-block" style="text-align: center;" align="center">

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?logo=typescript&logoColor=white)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![GitHub Repo stars](https://img.shields.io/github/stars/mellowtel-inc/mellowtel-js)](https://github.com/mellowtel-inc/mellowtel-js)
[![Discord](https://img.shields.io/discord/1221455179619106887?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.com/invite/GC8vwpDWC9)

</div>

---

# Introduction ℹ️

With Mellowtel's Open-Source library, your users can share a fraction of their unused internet by using a transparent opt-in/out mechanism. Trusted partners — from startups to enterprises — access the internet through this network to train their AI models, and you get paid for it.

**How?**

AI labs & startups need to scrape the web to train their models. They need a lot of publicly available data, and they need it fast. Mellowtel provides them with a way to access the internet at scale, by using a decentralized network of consensual users. You get a share of the revenue for providing access to your users' unused internet.

# Key Features 🎯

- **Easy to use**: Monetize your Chrome Extensions with a few lines of code.
- **Open-source**: Transparency is at the core of Mellowtel. Our code is open-source and available for everyone.
- **Consensual & Opt-out by default**: We believe in the power of informed consent. Your users are always in control. Only they decide if they want to support your extension through an explicit opt-in mechanism (not some small print in TOS). They can opt-out at any time.
- **Non-intrusive & Private**: We do not collect, share, or sell personal information (not even anonymized data). Mellowtel doesn't negatively affect user experience.
- **Highly regulated**: We keep communicating with Chrome Web Store regulators in order to guarantee a safe experience. Mellowtel provides CWS regulators with tools to monitor and enforce compliance (e.g. A custom dashboard for the Chrome Team to review every single URL that passes through the network)

# Why❓

We believe that extension developers should be able to monetize their work without compromising their users' privacy or experience. Most Chrome Extensions provide a lot of value to users, but they are not willing to pay for them.

Mellowtel gives your users a way to support your extension without having to directly pay for it. They can instead choose to share a fraction of their unused internet bandwidth. It's a win-win situation for everyone: users pay with a resource they didn't even know they had, and you get paid for your work.

Hopefully this will lead to fewer extensions being shut down or discontinued due to inability to monetize, fewer personal data being collected and sold, and more transparency in the Chrome Extension ecosystem.

See other "monetization solutions" below for examples of what can go wrong when developers are not given a fair way to monetize their work.

# What are the current "monetization solutions"? 🧐

We have been developing Chrome Extensions and trying to monetize them for years. We, too, received a hefty amount of the "monetization solutions" emails.

Well, honestly, most attempts to monetize Chrome Extensions are just shady at best and total scams at worst. They either buy your extension or provide SDKs that collect and sell your users' personal data (credit card information, addresses), spoof their passwords, inject unwanted ads into your extension, inject affiliate links, etc.

A recommended read: [Temptations of an open-source browser extension developer](https://github.com/extesy/hoverzoom/discussions/670)

And a highlight from the article 😰:

> "...we provide several methods of monetizating- from the soft to the hard methods."

# Getting started 🚀

## 1. Installation 💿

Get the _mellowtel_ library.

### With npm

```sh npm
npm install mellowtel
```

## 2. Set up your Manifest

Mellowtel requires some permissions to work properly (`storage`, `tabs`, `declarativeNetRequest`).

Depending on which permissions you have already requested and which you haven't, there are two ways to proceed with the integration.

### Option 1

If, when installing your extension, an alert window pops up asking for permission to `Read and change all your data on all websites`, you can simply update your `manifest.json` file:

```json
{
  "permissions": ["storage", "tabs", "declarativeNetRequest"],
  "host_permissions": ["\u003Call_urls\u003E"]
}
```

`host_permissions` is used by declarativeNetRequest to allow the extension to intercept requests on all URLs. It won't trigger another permission alert window, but you need to justify it in the Web Store section.

### Option 2

If the alert window doesn't pop up, or asks for permissions only on specific websites, you need to add `tabs` and `declarativeNetRequestWithHostAccess` to your `optional_permissions`. Also add `https://*/*` to the `optional_host_permissions` section.
Mellowtel will automatically request these permissions if the user decides to opt in.
If it's not already there, you also need to add the `storage` permission. This can be done in the `permissions` section as it doesn't display an alert window.

```json
{
  "optional_permissions": ["tabs", "declarativeNetRequestWithHostAccess"],
  "optional_host_permissions": ["https://*/*"],
  "permissions": ["storage"]
}
```

### Web Store Justification

The Web Store requires you to justify the permissions you are requesting. Here is a template you can use (it explains how Mellowtel uses the permissions):

**Tabs**:

```txt
The tabs permission is required to access the URL of the current page in the service worker. It also facilitates messaging between the contentScript and the service worker.
```

**DeclarativeNetRequest**:

```txt
The declarativeNetRequest permission is required to strip certain headers (e.g. X-Frame headers) from some responses on the sub_frame level. This allows displaying websites in an iframe without running into issues related to cross-origin resource sharing (CORS). These headers are immediately restored after the response is processed.
```

**Host Permissions**:

```txt
The host permissions on all_urls are required to let declarativeNetRequest modify response headers on all URLs. This is necessary to strip certain headers (e.g. X-Frame headers) from some responses on the sub_frame level. This allows displaying websites in an iframe without running into issues related to cross-origin resource sharing (CORS). These headers are immediately restored after the response is processed.
```

## 3. Set up your background script

In your `background.js` file, you need to import the `mellowtel` package.

```javascript
import Mellowtel from "mellowtel";
```

You can then use `Mellowtel(configuration_key, options?)` to create a new instance of the Mellowtel object. The Mellowtel object is your entrypoint to the rest of Mellowtel's SDK. Your `configuration_key` is required when calling this function, as it identifies your extension to Mellowtel. You can find your `configuration_key` in the dashboard.

```javascript
const mellowtel = new Mellowtel("<configuration_key>");
```

Initialize Mellowtel by calling the `initBackground` method. This method will initialize the Mellowtel object and set up the necessary listeners.

```javascript
await mellowtel.initBackground();
```

Only for the first time, you will need to show a disclaimer/message to the end-user. You can do so in a web page or in a popup (even at a later point). The methods
`getOptInStatus()`, `optIn()`, `optOut()` and `start()` are accessible from any part of your extension, so you can call them from a popup, a content script, or a background script.

To check if the user has already opted in, you can call the `getOptInStatus` method, which is a promise that resolves to a boolean value.

```javascript
const hasOptedIn = await mellowtel.getOptInStatus();
```

Once the user has read the disclaimer and agreed to join the network, call these methods:

```javascript
await mellowtel.optIn();
await mellowtel.start();
```

If the user decides to opt out, you can call the `optOut` method. Mellowtel won't activate for this user anymore until the user opts in again.

```javascript
await mellowtel.optOut();
```

## 4. Set up your content script

You have to import the `mellowtel` package in your content script as well.

```javascript
import Mellowtel from "mellowtel";
```

Again, you can use `Mellowtel(configuration_key, options?)` to create a new instance of the Mellowtel object.

```javascript
const mellowtel = new Mellowtel("<configuration_key>");
```

Initialize Mellowtel by calling the `initContentScript()` method. This method will initialize the Mellowtel object and set up the necessary listeners.

```javascript
await mellowtel.initContentScript();
```

This content script should run in `all_frames` and `<all_urls>` at the `document_start`, so you need to add the following to your `manifest.json` file:

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ]
}
```

If, for some reason, you can't have your content script running with these settings, just create a new content script that runs with these settings and import the `mellowtel` package in it.

# Quickstart

[Here](https://docs.mellowtel.it/get-started/quickstart) is a detailed guide on how to get started with Mellowtel.

# Contributing 🫶

Mellowtel is an open-source project, and contributions are welcome. If you want to contribute, you can create new features, fix bugs, or improve the infrastructure. Please refer to the [CONTRIBUTING.md](https://github.com/mellowtel-inc/mellowtel-js/blob/main/CONTRIBUTING.md) file in the repository for more information on how to contribute.

To see how to contribute, visit [Contribution guidelines](https://github.com/mellowtel-inc/mellowtel-js/blob/main/CONTRIBUTING.md)

# Authors 🧑‍💻

- Arslan A. ([LinkedIn](https://www.linkedin.com/in/arslan-ali-00957b249/))

You can reach out to us on [Discord](https://discord.gg/GC8vwpDWC9) if you have any questions or need help.

# License 📜

GNU Lesser General Public License v3.0

[License](https://github.com/mellowtel-inc/mellowtel-js/blob/main/LICENSE.MD)
