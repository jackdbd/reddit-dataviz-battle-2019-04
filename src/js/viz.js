import fetch from 'cross-fetch';
import { max, min, range } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';
import { easeLinear } from 'd3-ease';
import { scaleBand, scaleLinear } from 'd3-scale';
import { select, selectAll } from 'd3-selection';
import { transition } from 'd3-transition';
import { encaseP, tryP } from 'fluture';

import '../css/viz.css';

const NUM_SAMPLES = 10;

const mouseover = (d, i, nodes) => {
  console.warn(d, i, nodes);
  const selection = select(nodes[i]);
  selection.classed('bar--highlighted', true);
};

const mouseoutTransition = transition('mouseout-transition')
  .duration(750)
  .ease(easeLinear);

const mouseout = (d, i, nodes) => {
  const selection = select(nodes[i]);
  selection.transition(mouseoutTransition); // or 'mouseout-transition'
  selection.classed('bar--highlighted', false);
};

const prepareChart = selector => {
  const margin = {
    top: 20,
    right: 20,
    bottom: 30,
    left: 100,
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
    .attr('transform', `translate(${margin.left}, ${margin.right})`);

  return { chart, width, height };
};

const redrawChart = (chart, width, height, datasets, chosenDataset) => {
  const data = datasets[chosenDataset];

  const { xScale, yScale } = updateScales(data, width, height);

  const xAxis = axisBottom().scale(xScale);
  const yAxis = axisLeft().scale(yScale);
  // .tickValues([]);

  const axisX = chart
    .append('g')
    .attr('class', 'axis-x')
    .attr('transform', `translate(0, ${height})`)
    .call(xAxis)
    .append('text')
    .attr('x', width)
    .attr('dy', '-0.5em')
    .style('text-anchor', 'end')
    .text(`${chosenDataset}`);

  const axisY = chart
    .append('g')
    .attr('class', 'axis-y')
    .call(yAxis);

  const bars = chart
    .append('g')
    .attr('class', 'bars')
    .selectAll('.bar')
    .data(data);

  bars
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', 0)
    .attr('width', d => xScale(d))
    .attr('y', (d, i) => yScale(i))
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

const updateScales = (data, width, height) => {
  const xScale = scaleLinear()
    .domain([0, max(data)])
    .range([0, width]);

  const yScale = scaleBand()
    .domain(range(NUM_SAMPLES))
    .range([height, 0])
    .paddingInner(0.05);

  return {
    xScale,
    yScale,
  };
};

const draw = (selector, fetchedData) => {
  const datasets = makeDatasets(fetchedData);
  const { chart, width, height } = prepareChart(selector);

  redrawChart(chart, width, height, datasets, 'dataOccurrences');

  select('#dataWord').on('click', (d, i) => {
    redrawChart(chart, width, height, datasets, 'dataOccurrences');
  });

  select('#comments').on('click', (d, i) => {
    redrawChart(chart, width, height, datasets, 'comments');
  });

  select('#upvotes').on('click', (d, i) => {
    redrawChart(chart, width, height, datasets, 'upvotes');
  });

  select('#upvotesPercentage').on('click', (d, i) => {
    redrawChart(chart, width, height, datasets, 'upvotesPercentage');
  });
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
