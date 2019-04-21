import fetch from 'cross-fetch';
import { descending, max, min, range } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';
import { easeLinear } from 'd3-ease';
import { scaleBand, scaleLinear } from 'd3-scale';
import { select, selectAll } from 'd3-selection';
import { transition } from 'd3-transition';
import { encaseP, tryP } from 'fluture';

import '../css/viz.css';

const NUM_SAMPLES = 10;

const mouseoutTransition = transition('mouseout-transition')
  .duration(750)
  .ease(easeLinear);

const mouseover = (d, i, nodes) => {
  const selection = select(nodes[i]);
  selection.classed('bar--highlighted', true);
};

const mouseout = (d, i, nodes) => {
  const selection = select(nodes[i]);

  // or 'mouseout-transition'
  selection.transition(mouseoutTransition);
  selection.classed('bar--highlighted', false);
};

/**
 * Prepare the SVG elements and return d3 selections.
 */
const prepareChart = selector => {
  const margin = {
    top: 20,
    right: 20,
    bottom: 30,
    left: 200,
  };

  const width = 960 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const svg = selectAll(selector)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom);

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

  return { axisX, axisY, barsGroup, chart, height, width };
};

/**
 * Update the scales, that depend on the dataset, width and height.
 */
const updateScales = (data, width, height) => {
  const xScale = scaleLinear()
    .domain([0, max(data)])
    .range([0, width]);

  const yScale = scaleBand()
    .domain(range(NUM_SAMPLES))
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
  height
) => {
  const xAxisFn = axisBottom().scale(xScale);
  axisX.call(xAxisFn);

  const text = axisX.selectAll('text').data([1]);

  text
    .enter()
    .append('text')
    .merge(text)
    .attr('class', 'axis-x-text')
    .attr('x', width)
    .attr('dy', '-0.5em')
    .style('text-anchor', 'end')
    .text(chosenDataset);

  // TODO: use different classes for different topics (e.g. comments vs upvotes)

  // TODO: fix transitions

  // TODO: ticks for yAxis. Update tick values from chosen dataset
  const values = 'abcdefghij'.split('');
  const yAxisFn = axisLeft()
    .scale(yScale)
    .tickValues(values);

  const barHeight = height / NUM_SAMPLES; // not exactly, there is also the padding;

  axisY
    .call(yAxisFn)
    .selectAll('.tick')
    .attr(
      'transform',
      (d, i) => `translate(0, ${i * barHeight + barHeight / 2})`
    );
};

const drawChart = (selections, width, height, datasets, chosenDataset) => {
  const data = datasets[chosenDataset]
    .sort(descending)
    .filter((_, i) => i < NUM_SAMPLES);

  const { xScale, yScale } = updateScales(data, width, height);
  const { axisX, axisY, barsGroup } = selections;

  updateAxes(xScale, axisX, yScale, axisY, chosenDataset, width, height);

  // data binding
  const bars = barsGroup.selectAll('.bar').data(data);

  // TODO: use different classes for different topics (e.g. comments vs upvotes)

  // TODO: fix transitions

  bars
    .enter()
    .append('rect')
    .merge(bars)
    .attr('class', `bar ${chosenDataset}`)
    .attr('x', 0)
    .attr('width', d => xScale(d))
    .attr('y', (_, i) => yScale(i))
    .attr('height', yScale.bandwidth())
    .on('mouseover', mouseover)
    .on('mouseout', mouseout);

  bars
    .exit()
    .transition()
    .duration(300)
    .attr('width', 0)
    .remove();
};

const makeDatasets = fetchedData => {
  const comments = fetchedData.map(d => d.comments);
  const dataOccurrences = fetchedData.map(d => d.dataOccurrences);
  const uniqueUsers = fetchedData.map(d => d.uniqueUsers);
  const upvotes = fetchedData.map(d => d.upvotes);

  const entry0 = {
    name: 'Comment',
    count: comments.length,
    min: min(comments),
    max: max(comments),
  };
  const entry1 = {
    name: 'Data',
    count: dataOccurrences.length,
    min: min(dataOccurrences),
    max: max(dataOccurrences),
  };
  const entry2 = {
    name: 'Upvotes',
    count: upvotes.length,
    min: min(upvotes),
    max: max(upvotes),
  };

  console.table([entry0, entry1, entry2], ['name', 'count', 'min', 'max']);

  const datasets = {
    comments,
    dataOccurrences,
    uniqueUsers,
    upvotes,
  };

  return datasets;
};

const draw = (selector, fetchedData) => {
  const datasets = makeDatasets(fetchedData);
  const { axisX, axisY, barsGroup, chart, height, width } = prepareChart(
    selector
  );
  const selections = { axisX, axisY, barsGroup, chart };

  select('#dataWord').on('click', (d, i) => {
    drawChart(selections, width, height, datasets, 'dataOccurrences');
  });

  select('#comments').on('click', () => {
    drawChart(selections, width, height, datasets, 'comments');
  });

  select('#upvotes').on('click', () => {
    drawChart(selections, width, height, datasets, 'upvotes');
  });

  select('#upvotesPercentage').on('click', () => {
    drawChart(selections, width, height, datasets, 'upvotesPercentage');
  });

  drawChart(selections, width, height, datasets, 'dataOccurrences');
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
