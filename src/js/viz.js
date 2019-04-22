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

const mouseover = (d, i, nodes) => {
  const selection = select(nodes[i]);
  selection.classed('bar--highlighted', true);
};

const mouseout = (_, i, nodes) => {
  const selection = select(nodes[i]);
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

  return {
    axisX,
    axisY,
    barsGroup,
    chart,
    height,
    width,
  };
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

  const textUpdate = axisX.selectAll('text').data([1]);

  const textEnter = textUpdate
    .enter()
    .append('text')
    .merge(textUpdate)
    .attr('class', `axis-x-text ${chosenDataset}`)
    .attr('x', width)
    .attr('dy', '0em')
    .style('text-anchor', 'end')
    .style('opacity', 0.25)
    .text(chosenDataset);

  textEnter
    .transition()
    .duration(500)
    .ease(easeLinear)
    .attr('dy', '-0.5em')
    .style('opacity', 1);

  // TODO: ticks for yAxis. Update tick values from chosen dataset
  const values = [
    'postId1',
    'postId2',
    'postId3',
    'postId4',
    'postId5',
    'postId6',
    'postId7',
    'postId8',
    'postId9',
    'postId10',
  ];
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
  // TODO: data should contain postId and the chosen dataset. Sort by the chosen
  // dataset and keep the postId (i need it for the labels on the y axis).
  const data = datasets[chosenDataset]
    .sort(descending)
    .filter((_, i) => i < NUM_SAMPLES);

  const { xScale, yScale } = updateScales(data, width, height);
  const { axisX, axisY, barsGroup } = selections;

  updateAxes(xScale, axisX, yScale, axisY, chosenDataset, width, height);

  // join data, store update selection
  const barsUpdate = barsGroup.selectAll('.bar').data(data);

  const barsEnter = barsUpdate
    .enter()
    .append('rect')
    .merge(barsUpdate)
    .attr('x', width)
    .attr('y', (_, i) => yScale(i))
    .attr('height', yScale.bandwidth() / 2)
    // gotcha: if you forget to assign the '.bar' class, each time you change
    // dataset the class will change, resulting in an enter selection which will
    // not merge with the update selection (so you'll end up with NUM_SAMPLES
    // additional rect elements each time you change dataset, instead of
    // replacing older rect elements with newer ones).
    .attr('class', `bar ${chosenDataset}`)
    .style('opacity', 0.25)
    // event listeners must be attached on the enter selection
    .on('mouseover', mouseover)
    .on('mouseout', mouseout);

  const barsTransition = barsEnter
    // transition each SVG rect to its final width and height, but yet not x.
    .transition(easeLinear1000)
    .attr('width', d => xScale(d))
    .attr('height', yScale.bandwidth())
    // when the previous transition ends, start a new transition
    .on('end', transitionToFinalX);

  // In the exit selection we don't have anything to remove because all our
  // datasets have the same number of samples. Note that we still need to merge,
  // otherwise the selection would be empty.

  const barsExit = barsUpdate.exit().merge(barsUpdate);

  console.log('barsTransition', barsTransition, 'barsExit', barsExit);
};

const makeDatasets = fetchedData => {
  const comments = fetchedData.map(d => d.comments);
  const dataOccurrences = fetchedData.map(d => d.dataOccurrences);
  const uniqueUsers = fetchedData.map(d => d.uniqueUsers);
  const upvotes = fetchedData.map(d => d.upvotes);
  const upvotesPercentage = fetchedData.map(d => d.upvotesPercentage);

  const entries = [
    {
      name: 'Comment',
      count: comments.length,
      min: min(comments),
      max: max(comments),
    },
    {
      name: 'Data',
      count: dataOccurrences.length,
      min: min(dataOccurrences),
      max: max(dataOccurrences),
    },
    {
      name: 'Upvotes',
      count: upvotes.length,
      min: min(upvotes),
      max: max(upvotes),
    },
    {
      name: 'UpvotesPercentage',
      count: upvotesPercentage.length,
      min: min(upvotesPercentage),
      max: max(upvotesPercentage),
    },
  ];

  console.table(entries, ['name', 'count', 'min', 'max']);

  const datasets = {
    comments,
    dataOccurrences,
    uniqueUsers,
    upvotes,
    upvotesPercentage,
  };

  return datasets;
};

const draw = (selector, fetchedData) => {
  const datasets = makeDatasets(fetchedData);
  const { axisX, axisY, barsGroup, chart, height, width } = prepareChart(
    selector
  );
  const selections = {
    axisX,
    axisY,
    barsGroup,
    chart,
  };

  select('#dataWord').on('click', () => {
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
