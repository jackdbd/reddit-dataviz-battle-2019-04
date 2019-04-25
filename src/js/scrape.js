const { writeFile } = require('fs');
const { resolve } = require('path');
const { promisify } = require('util');
const chalk = require('chalk');
const puppeteer = require('puppeteer');
const { PendingXHR } = require('pending-xhr-puppeteer');

const writeFileAsync = promisify(writeFile);

const IMAGES_DIR = resolve(__dirname, '..', '..', 'images');
const DATA_DIR = resolve(__dirname, '..', '..', 'data');

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
    /**
     * Utility function to sanitize a string and parse it.
     *
     * This function cannot be defined outside of this evaluate function because
     * here we are in a browser executution, while outside we are in a Node.js
     * execution context.
     */
    const parseString = str => {
      const strSanitized = str.replace(',', '').replace('k', '000');
      const num = parseInt(strSanitized, 10);
      return num;
    };

    const selector0 = 'div[data-test-id="post-content"] i.icon-comment+span';
    const commentsStr = document
      .querySelector(selector0)
      .innerText.split(' ')[0];
    const comments = parseString(commentsStr);

    const selector1 = 'div[data-test-id="post-content"] button+div';
    const upvotesStr = document.querySelector(selector1).innerText;
    const upvotes = parseString(upvotesStr);

    const selector2 = 'a[href^="/user/"]';
    const nodeList = document.querySelectorAll(selector2);

    const allUsers = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const n of nodeList) {
      allUsers.push(n.innerText);
    }

    const uniqueUsers = allUsers.filter(
      (elem, pos) => allUsers.indexOf(elem) === pos
    );

    const selector3 =
      'div[data-test-id="post-content"] a[href^="http://i.imgur.com/"]';
    const anchorElem = document.querySelector(selector3);

    let imageUrl;
    if (anchorElem) {
      imageUrl = anchorElem.getAttribute('href');
    } else {
      imageUrl = undefined;
    }

    let xPathExpression = 'count(//*[contains(text(),"Data")])';
    let xPathResult = document.evaluate(
      xPathExpression,
      document,
      null,
      XPathResult.NUMBER_TYPE,
      null
    );
    const dataOccurrences = xPathResult.numberValue;

    xPathExpression =
      '//div[@data-test-id="post-content"]//span[contains(text(),"% Upvoted")]';
    xPathResult = document.evaluate(
      xPathExpression,
      document,
      null,
      XPathResult.ANY_TYPE,
      null
    );
    const span = xPathResult.iterateNext();
    const upvotesPercentage = parseInt(span.innerText.split('%')[0], 10);

    return {
      comments,
      imageUrl,
      dataOccurrences,
      uniqueUsers,
      upvotes,
      upvotesPercentage,
    };
  });

  console.log(`
  Comments: ${chalk.yellow(data.comments)}
  Imgur image: ${chalk.yellow(data.imageUrl)}
  Occurrences of the word "Data": ${chalk.yellow(data.dataOccurrences)}
  Users with 1+ comments: ${chalk.green(data.uniqueUsers)}
  Upvotes: ${chalk.yellow(data.upvotes)}
  Upvotes Percentage: ${chalk.yellow(data.upvotesPercentage)}
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
    postId,
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

  const threadUrls = await page.$eval('pre', el => el.innerHTML.split('\n'));

  console.log(chalk.green(`Found ${threadUrls.length} Thread URLs`));
  // const urls = threadUrls.filter((d, i) => i < 3 || i === 566);
  const urls = threadUrls;

  const entries = [];
  for (let i = 0; i < urls.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const result = await doPage(page, urls[i], i);
    const entry = {
      comments: result.data.comments,
      dataOccurrences: result.data.dataOccurrences,
      imageUrl: result.data.imageUrl,
      postId: result.postId,
      title: result.title,
      uniqueUsers: result.data.uniqueUsers,
      upvotes: result.data.upvotes,
      upvotesPercentage: result.data.upvotesPercentage,
      url: result.url,
    };
    entries.push(entry);
  }

  await browser.close();

  const jsonString = JSON.stringify(entries);
  const filePath = `${DATA_DIR}/data.json`;

  try {
    await writeFileAsync(filePath, jsonString, { encoding: 'utf8' });
  } catch (err) {
    console.error('An error occured while writing the JSON File.');
  }
};

fn();
