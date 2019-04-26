# Reddit DataViz Battle April 2019

Code for the Reddit dataisbeautiful [DataViz Battle for the Month of April 2019](https://www.reddit.com/r/dataisbeautiful/comments/b8ws37/battle_dataviz_battle_for_the_month_of_april_2019/).

Visualize the April Fool's Prank for 2019-04-01 on /r/DataIsBeautiful.

![A GIF file that shows how to interact with the visualization](https://github.com/jackdbd/reddit-dataviz-battle-2019-04/blob/master/images/demo.gif "Demo of the visualization.")

Here is the [viz](https://jackdbd.github.io/reddit-dataviz-battle-2019-04/).

## Installation

```sh
git clone git@github.com:jackdbd/reddit-dataviz-battle-2019-04.git
cd reddit-dataviz-battle-2019-04
yarn
```

The data for this visualization was scraped with [Puppeteer](https://github.com/GoogleChrome/puppeteer).

You can find it at `data/data.json`.

You can also run the script by yourself if you want (keep in mind that if the subreddit changes, portions of this script or the entire script may fail).

```shell
yarn scrape
```

To run the visualization locally, type:

```shell
yarn dev
```
