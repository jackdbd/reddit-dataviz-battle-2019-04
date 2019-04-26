import fetch from 'cross-fetch';
import { max, range } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';
import { easeLinear } from 'd3-ease';
import { scaleBand, scaleLinear } from 'd3-scale';
import { event, select, selectAll } from 'd3-selection';
import { transition } from 'd3-transition';
import { encaseP, tryP } from 'fluture';

import '../css/viz.css';

const R = require('ramda');

let numSamples = 20;
const IMG_SIZE = 128;
const IMG_PLACEHOLDER_URL = `https://bulma.io/images/placeholders/${IMG_SIZE}x${IMG_SIZE}.png`;

const margin = {
  top: 20,
  right: 20,
  bottom: 30,
  left: 100,
};

const easeLinear1000 = transition('ease-linear-1000')
  .duration(1000)
  .ease(easeLinear);

// transition a SVG rect to its final x, using a different duration each time.
const transitionToFinalX = (_, i, nodes) => {
  select(nodes[i])
    .transition()
    .duration(i * 100)
    .attr('x', 0)
    .style('opacity', 1);
};

const hasImgUrl = str => str.length > 0;

function mouseover(d) {
  // console.log(d)
  const { div, img, a } = this;
  const offsetX = 0.5 * IMG_SIZE;
  const offsetY = -0.5 * IMG_SIZE;

  div
    .transition()
    .duration(200)
    .style('opacity', 1)
    .style('left', `${event.layerX + offsetX}px`)
    .style('top', `${event.layerY + offsetY}px`);

  const src = hasImgUrl(d.imageUrl) ? d.imageUrl : IMG_PLACEHOLDER_URL;
  img.attr('src', src);

  a.attr('href', src);
}

/**
 * Prepare the SVG elements and return d3 selections.
 */
const prepareChart = selector => {
  const heroBody = document.querySelector('.hero-body');
  const width = heroBody.clientWidth - margin.left - margin.right;
  const height = heroBody.clientHeight - margin.top - margin.bottom;
  const viewBox = `0 0 ${width + margin.left + margin.right} ${height +
    margin.top +
    margin.bottom}`;

  const svg = selectAll(selector)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', viewBox)
    .attr('preserveAspectRatio', 'xMinYMin meet');

  const tooltipDiv = selectAll(selector)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  const tooltipFigure = tooltipDiv
    .append('figure')
    .attr('class', 'image is-128x128');

  const tooltipA = tooltipFigure
    .append('a')
    .attr('href', IMG_PLACEHOLDER_URL)
    .attr('target', '_blank')
    .attr('class', 'content');

  const tooltipImg = tooltipA
    .append('img')
    .attr('alt', 'Image posted in the thread')
    .attr('src', IMG_PLACEHOLDER_URL);

  const tooltipSelections = {
    a: tooltipA,
    div: tooltipDiv,
    img: tooltipImg,
  };

  const chart = svg
    .append('g')
    .attr('class', 'viz')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // We append the group for the bars before the group for the x axis, so the x
  // label will always be in foreground.
  const barsGroup = chart.append('g').attr('class', 'bars');

  const axisX = chart
    .append('g')
    .attr('class', 'axis axis-x')
    .attr('transform', `translate(0, ${height})`);

  const axisY = chart.append('g').attr('class', 'axis axis-y');

  return {
    axisX,
    axisY,
    barsGroup,
    chart,
    tooltipSelections,
    height,
    width,
  };
};

/**
 * Update the scales, that depend on the dataset, width and height.
 */
const updateScales = (data, width, height) => {
  const xValues = R.pluck('x')(data);

  const xScale = scaleLinear()
    .domain([0, max(xValues)])
    .range([0, width]);

  const yScale = scaleBand()
    .domain(range(numSamples))
    .range([0, height])
    .paddingInner(0.05);

  return {
    xScale,
    yScale,
  };
};

const updateAxes = (
  xScale,
  axisX,
  yScale,
  axisY,
  chosenDataset,
  width,
  height,
  data
) => {
  const xAxisFn = axisBottom().scale(xScale);
  axisX.call(xAxisFn);

  const xAxisTextUpdate = axisX.selectAll('text').data([1]);

  const xAxisTextEnter = xAxisTextUpdate
    .enter()
    .append('text')
    .merge(xAxisTextUpdate)
    .attr('class', `axis-x-text ${chosenDataset}`)
    .attr('x', width)
    .attr('dy', '0em')
    .style('text-anchor', 'end')
    .style('opacity', 0.25)
    .text(chosenDataset);

  xAxisTextEnter
    .transition()
    .duration(500)
    .ease(easeLinear)
    .attr('dy', '-0.5em')
    .style('opacity', 1);

  const yValues = R.pluck('Post ID')(data);
  const imageUrls = R.pluck('imageUrl')(data);

  const yAxisFn = axisLeft()
    .scale(yScale)
    .tickValues(yValues);

  const barHeight = height / numSamples; // not exactly, there is also the padding;

  axisY
    .call(yAxisFn)
    .selectAll('.tick')
    .classed(`${chosenDataset}`, (_, i) => hasImgUrl(imageUrls[i]))
    .attr(
      'transform',
      (_, i) => `translate(0, ${i * barHeight + barHeight / 2})`
    );

  // It's quite problematic to position the Y axis label correctly for all
  // screen sizes, so I decided to leave it out.
  // const yAxisTextUpdate = axisY.selectAll('text').data([1]);

  // const yAxisTextEnter = yAxisTextUpdate
  //   .enter()
  //   .append('text')
  //   .merge(yAxisTextUpdate)
  //   .attr('class', 'axis-y-text')
  //   .style('text-anchor', 'middle')
  //   .style('opacity', '0.25')
  //   .attr(
  //     'transform',
  //     `rotate(-90) translate(${-height / 2}, -${margin.left * 0.9})`
  //   )
  //   .text('Post ID');

  // yAxisTextEnter
  //   .transition()
  //   .duration(500)
  //   .ease(easeLinear)
  //   .style('opacity', 1);

  selectAll('.axis-y > .tick')
    .style('cursor', 'pointer')
    .on('click', d => {
      const href = `https://www.reddit.com/r/dataisbeautiful/comments/${d}/`;
      window.open(href, '_blank');
    });
};

const drawChart = (selections, width, height, fetchedData, chosenDataset) => {
  const pickChosen = d => R.pick(['postId', 'imageUrl', chosenDataset], d);
  const arrData = R.map(pickChosen, fetchedData);
  const byChosen = R.descend(R.prop(chosenDataset));
  const arr = R.sort(byChosen, arrData);

  const data = arr.filter((_, i) => i < numSamples);

  // https://github.com/ramda/ramda/wiki/Cookbook#rename-keys-of-an-object
  const renameKeys = R.curry((keysMap, obj) => {
    const fn = (acc, key) => R.assoc(keysMap[key] || key, obj[key], acc);
    return R.reduce(fn, {}, R.keys(obj));
  });

  const renameDatum = d =>
    renameKeys({ [chosenDataset]: 'x', postId: 'Post ID' }, d);
  const dataRenamed = R.map(renameDatum, data);

  const { xScale, yScale } = updateScales(dataRenamed, width, height);
  const { axisX, axisY, barsGroup, tooltipSelections } = selections;

  updateAxes(
    xScale,
    axisX,
    yScale,
    axisY,
    chosenDataset,
    width,
    height,
    dataRenamed
  );

  // join data, store update selection
  const barsUpdate = barsGroup.selectAll('.bar').data(dataRenamed);

  const barsEnter = barsUpdate
    .enter()
    .append('rect')
    .merge(barsUpdate)
    .attr('x', width)
    .attr('y', (_, i) => yScale(i))
    .attr('height', yScale.bandwidth() / 2)
    // gotcha: if you forget to assign the '.bar' class, each time you change
    // dataset the class will change, resulting in an enter selection which will
    // not merge with the update selection (so you'll end up with num_samples
    // additional rect elements each time you change dataset, instead of
    // replacing older rect elements with newer ones).
    .attr('class', `bar ${chosenDataset}`)
    .style('opacity', 0.25)
    // event listeners must be attached on the enter selection
    .on('mouseover', mouseover.bind(tooltipSelections));

  const barsTransition = barsEnter
    // transition each SVG rect to its final width and height, but yet not x.
    .transition(easeLinear1000)
    .attr('width', d => xScale(d.x))
    .attr('height', yScale.bandwidth())
    // when the previous transition ends, start a new transition
    .on('end', transitionToFinalX);

  const barsExit = barsUpdate
    .exit()
    .remove('rect')
    .merge(barsUpdate);

  console.log('barsTransition', barsTransition, 'barsExit', barsExit);
};

const draw = (selector, fetchedData) => {
  const {
    axisX,
    axisY,
    barsGroup,
    chart,
    tooltipSelections,
    height,
    width,
  } = prepareChart(selector);

  const selections = {
    axisX,
    axisY,
    barsGroup,
    chart,
    tooltipSelections,
  };

  const defaultDataset = 'dataOccurrences';

  select('#first-10').on('click', () => {
    numSamples = 10;
    drawChart(selections, width, height, fetchedData, defaultDataset);
  });

  select('#first-20').on('click', () => {
    numSamples = 20;
    drawChart(selections, width, height, fetchedData, defaultDataset);
  });

  select('#first-30').on('click', () => {
    numSamples = 30;
    drawChart(selections, width, height, fetchedData, defaultDataset);
  });

  select('#dataWord').on('click', () => {
    drawChart(selections, width, height, fetchedData, 'dataOccurrences');
  });

  select('#comments').on('click', () => {
    drawChart(selections, width, height, fetchedData, 'comments');
  });

  select('#upvotes').on('click', () => {
    drawChart(selections, width, height, fetchedData, 'upvotes');
  });

  select('#upvotesPercentage').on('click', () => {
    drawChart(selections, width, height, fetchedData, 'upvotesPercentage');
  });

  drawChart(selections, width, height, fetchedData, defaultDataset);
};

export const fn = async (selector, url) => {
  const drawBounded = draw.bind(this, selector);

  // convert fetch (which returns a Promise) to a function that returns a Future
  const fetchf = encaseP(fetch);

  fetchf(url)
    .chain(res => {
      const thunk = () => res.json();
      const future = tryP(thunk);
      return future;
    })
    .fork(console.error, drawBounded);
};
