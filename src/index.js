const { writeFile } = require('fs');
const { resolve } = require('path');
const { promisify } = require('util');
const chalk = require('chalk');
const puppeteer = require('puppeteer');
const { PendingXHR } = require('pending-xhr-puppeteer');

const writeFileAsync = promisify(writeFile);

const IMAGES_DIR = resolve(__dirname, '..', 'images');
const DATA_DIR = resolve(__dirname, '..', 'data');

// https://pptr.dev/#?product=Puppeteer&version=v1.14.0&show=api-puppeteerlaunchoptions
const launchOptions = {
  devtools: false,
  headless: true,
  timeout: 30000,
};

const gotoOptions = {
  timeout: 0, // remove navigation timeout
  waitUntil: 'networkidle2',
};

// page containing a list of all links
const urlLinks = 'https://pastebin.com/raw/djbR067n';

const doPage = async (page, url, i) => {
  const splits = url.split('/');
  const postId = splits[splits.length - 1];
  console.log(`URL ${i + 1}: ${chalk.green(url)}`);

  const response = await page.goto(url, gotoOptions);

  // UNfortunately, this does not seem to work...
  page.on('dialog', async dialog => {
    console.log('--- DIALOG ---', dialog.message());
    await dialog.dismiss();
  });

  const title = await page.$eval('h2', el => el.innerText);

  // await page.waitFor(10000);

  // Note: not all pages have the "View all [number] replies" button
  // const jsHandle = await page.waitForXPath(
  //   '//button[contains(text(),"View all")]'
  // );
  // const elementHandle = jsHandle.asElement();

  // await elementHandle.focus();
  // await elementHandle.click();

  /**
   * Evaluate a function in a browser execution environment.
   *
   * Note: non-serializable values cannot be passed to the function to evaluate,
   * nor returned by it.
   *
   * @see https://pptr.dev/#?product=Puppeteer&version=v1.14.0&show=api-pageevaluatepagefunction-args
   */
  const data = await page.evaluate(() => {
    const selector0 = 'div[data-test-id="post-content"] i.icon-comment+span';
    const comments = document.querySelector(selector0).innerText.split(' ')[0];

    const selector1 = 'div[data-test-id="post-content"] button+div';
    const upvotes = document.querySelector(selector1).innerText;

    const selector2 = 'a[href^="/user/"]';
    const nodeList = document.querySelectorAll(selector2);

    let allUsers = [];
    for (const n of nodeList) {
      allUsers.push(n.innerText);
    }

    const uniqueUsers = allUsers.filter((elem, pos) => {
      return allUsers.indexOf(elem) == pos;
    });

    const selector3 =
      'div[data-test-id="post-content"] a[href^="http://i.imgur.com/"]';
    const anchorElem = document.querySelector(selector3);

    let imageUrl;
    if (anchorElem) {
      imageUrl = anchorElem.getAttribute('href');
    } else {
      imageUrl = undefined;
    }

    const xPathExpression = 'count(//*[contains(text(),"Data")])';
    const xPathResult = document.evaluate(
      xPathExpression,
      document,
      null,
      XPathResult.NUMBER_TYPE,
      null
    );
    const numData = xPathResult.numberValue;

    return {
      comments,
      imageUrl,
      numData,
      uniqueUsers,
      upvotes,
    };
  });

  console.log(`
  Comments: ${chalk.yellow(data.comments)}
  Imgur image: ${chalk.yellow(data.imageUrl)}
  Occurrences of "Data": ${chalk.yellow(data.numData)}
  Users with 1+ comments: ${chalk.green(data.uniqueUsers)}
  Upvotes: ${chalk.yellow(data.upvotes)}
  `);

  if (data.imageUrl) {
    const screenshotOptions = {
      // clip: { x: 15, y: 180, width: 750, height: 300 },
      // fullPage: true,
      path: `${IMAGES_DIR}/post-${postId}-image.png`,
      type: 'png',
    };
    await page.goto(data.imageUrl, gotoOptions);
    await page.screenshot(screenshotOptions);
  }

  const result = {
    data,
    'response-status': response.status(),
    title,
    url,
  };
  return result;
};

const fn = async () => {
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  const pendingXHR = new PendingXHR(page);
  await page.goto(urlLinks, gotoOptions);
  console.log(
    `There are still ${pendingXHR.pendingXhrCount()} XHR pending requests.`
  );
  await pendingXHR.waitForAllXhrFinished();

  const threadUrls = await page.$eval('pre', el => {
    return el.innerHTML.split('\n');
  });

  console.log(chalk.green(`Found ${threadUrls.length} Thread URLs`));
  // const urls = threadUrls.filter((d, i) => i === 0 || i === 566);
  const urls = threadUrls;

  const dataEntries = [];
  for (let i = 0; i < urls.length; i++) {
    const result = await doPage(page, urls[i], i);
    dataEntries.push(result.data);
  }

  await browser.close();

  const jsonString = JSON.stringify(dataEntries);
  const filePath = `${DATA_DIR}/data.json`;

  try {
    await writeFileAsync(filePath, jsonString, { encoding: 'utf8' });
  } catch (err) {
    console.error('An error occured while writing the JSON File.');
  }
};

fn();
