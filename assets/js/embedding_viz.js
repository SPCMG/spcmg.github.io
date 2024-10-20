// Data Processing with annotation limit
function processData(data, numAnnotations) {
  var points = [];
  var humanml3dTexts = new Set();
  var tempBabelTexts = new Set();
  var counter = 0; // Counter to track number of processed annotations

  for (var seqKey in data) {
    if (counter >= numAnnotations) break; // Stop processing after numAnnotations
    var sequence = data[seqKey];
    var annotations = sequence.annotations;
    var babelTextsInSequence = [];

    annotations.forEach(function(annotation) {
      if (annotation.seg_id.startsWith('babel_')) {
        tempBabelTexts.add(annotation.text);
        babelTextsInSequence.push(annotation.text);
      }
    });

    annotations.forEach(function(annotation) {
      if (annotation.seg_id.startsWith('humanml3d_') && counter < numAnnotations) {
        humanml3dTexts.add(annotation.text);
        var point = {
          x: annotation.clip_embedding_2d[0],
          y: annotation.clip_embedding_2d[1],
          humanml3d_text: annotation.text,
          labels: babelTextsInSequence.slice() // Copy of babel texts
        };
        points.push(point);
        counter++;
      }
    });
  }

  var babelTextList = Array.from(tempBabelTexts);
  var humanml3dTextList = Array.from(humanml3dTexts);
  var babelTextToColor = assignColors(babelTextList);

  return { points, babelTextList, humanml3dTextList, babelTextToColor };
}

// Assign colors to text list
function assignColors(textList) {
  var colorScale = d3.scaleOrdinal(d3.schemeCategory10);
  var textToColor = {};
  textList.forEach(function(text, index) {
    textToColor[text] = colorScale(index);
  });
  return textToColor;
}

// Visualization Setup
function createSvgAndScales(width, height, margin, points) {
  var xExtent = d3.extent(points, function(d) { return d.x; });
  var yExtent = d3.extent(points, function(d) { return d.y; });
  var maxExtent = d3.max([Math.abs(xExtent[0]), Math.abs(xExtent[1]), Math.abs(yExtent[0]), Math.abs(yExtent[1])]);

  var aspectRatio = (height - margin.top - margin.bottom) / (width - margin.left - margin.right);

  var xScale = d3.scaleLinear()
                 .domain([-maxExtent * 1.1, maxExtent * 1.1]) 
                 .range([margin.left, width - margin.right]);

  var yScale = d3.scaleLinear()
                 .domain([-maxExtent * 1.1 * aspectRatio, maxExtent * 1.1 * aspectRatio]) 
                 .range([height - margin.bottom, margin.top]);

  var svg = d3.select("#embedding_viz")
              .append("svg")
              .attr("width", width)
              .attr("height", height);

  var xAxis = d3.axisBottom(xScale).ticks(10);
  svg.append("g")
      .attr("transform", "translate(0," + yScale(0) + ")")  // Position x-axis at y = 0
      .call(xAxis);
      
  var yAxis = d3.axisLeft(yScale).ticks(10);
  svg.append("g")
      .attr("transform", "translate(" + xScale(0) + ",0)")  // Position y-axis at x = 0
      .call(yAxis);

  return { svg, xScale, yScale, xAxis, yAxis };
}

// Tooltip Setup
function createTooltip() {
  return d3.select("body").append("div")
           .attr("id", "tooltip")
           .style("position", "absolute")
           .style("background-color", "#f0f0f0")
           .style("padding", "5px")
           .style("border", "1px solid #ccc")
           .style("font-size", "12px")
           .style("display", "none");
}

// Utility function to truncate text if too long
function truncateText(text, maxLength) {
  if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
  }
  return text;
}

// Create Dropdowns
function createDropdowns(babelTextList, humanml3dTextList) {
  // Max length for the dropdown text
  var maxLength = 100;

  var babelDropdown = d3.select("#babelDropdown").append("select").attr("id", "babelSelect");
  var humanml3dDropdown = d3.select("#humanml3dDropdown").append("select").attr("id", "humanml3dSelect");

  babelDropdown.append("option").attr("value", "").text("Select a BABEL text");
  humanml3dDropdown.append("option").attr("value", "").text("Select a HumanML3D text");

  babelDropdown.selectAll("option.babelOption")
              .data(babelTextList)
              .enter()
              .append("option")
              .attr("class", "babelOption")
              .attr("value", function(d) { return d; })
              .text(function(d) { return truncateText(d, maxLength); });

  humanml3dDropdown.selectAll("option.humanOption")
                  .data(humanml3dTextList)
                  .enter()
                  .append("option")
                  .attr("class", "humanOption")
                  .attr("value", function(d) { return d; })
                  .text(function(d) { return truncateText(d, maxLength); });

  return { babelDropdown, humanml3dDropdown };
}

// Setup Dropdown Handlers
function setupDropdownHandlers(svg, points, babelTextToColor, babelDropdown, humanml3dDropdown) {
  babelDropdown.on("change", function() {
    var selectedBabelText = this.value;
    d3.select("#humanml3dTexts").text("");  // Clear previous HumanML3D texts
    d3.select("#babelTexts").text("");      // Clear previous BABEL texts

    if (selectedBabelText === "") {
      svg.selectAll("circle").attr("fill", "grey");
      return;
    }

    var correspondingHumanml3dTexts = points.filter(function(d) {
      return d.labels.includes(selectedBabelText);
    }).map(function(d) {
      return d.humanml3d_text;
    });

    correspondingHumanml3dTexts = Array.from(new Set(correspondingHumanml3dTexts)); // Remove duplicates

    d3.select("#humanml3dTexts").html("Corresponding HumanML3D Texts:<br>" +
      correspondingHumanml3dTexts.map(function(d) {
        return "<div>" + d + "</div>";
      }).join(""));

    svg.selectAll("circle")
       .attr("fill", function(d) {
         if (d.labels.includes(selectedBabelText)) {
           return babelTextToColor[selectedBabelText];
         } else {
           return "transparent";
         }
       });
  });

  humanml3dDropdown.on("change", function() {
    var selectedHumanml3dText = this.value;
    d3.select("#babelTexts").text("");
    d3.select("#humanml3dTexts").text("");

    if (selectedHumanml3dText === "") {
      svg.selectAll("circle").attr("fill", "grey");
      return;
    }

    var correspondingBabelTexts = points.filter(function(d) {
      return d.humanml3d_text === selectedHumanml3dText;
    }).map(function(d) {
      return d.labels;
    });

    correspondingBabelTexts = Array.from(new Set([].concat.apply([], correspondingBabelTexts))); // Flatten and remove duplicates

    d3.select("#babelTexts").html("Corresponding BABEL Texts:<br>" +
      correspondingBabelTexts.map(function(d) {
      return "<div>" + d + "</div>";
    }).join(""));

    svg.selectAll("circle")
       .attr("fill", function(d) {
         if (d.humanml3d_text === selectedHumanml3dText) {
           return "blue";
         } else {
           return "transparent";
         }
       });
  });
}

// Drawing Points
function drawPoints(svg, points, xScale, yScale, tooltip) {
  svg.selectAll("circle")
     .data(points)
     .enter()
     .append("circle")
     .attr("cx", function(d) { return xScale(d.x); })
     .attr("cy", function(d) { return yScale(d.y); })
     .attr("r", 5)
     .attr("fill", "grey")
     .on("mouseover", function(event, d) {
        tooltip.style("display", "block");

        var correspondingBabelTexts = Array.from(new Set(d.labels)).join(", ");
        var content = `<strong>clip_embedding_2d:</strong> (${d.x.toFixed(2)}, ${d.y.toFixed(2)})<br>` +
                      `<strong>HumanML3D Text:</strong> ${d.humanml3d_text}<br>` +
                      `<strong>Corresponding BABEL Texts:</strong> ${correspondingBabelTexts}`;

        tooltip.html(content)
               .style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 10) + "px");
     })
     .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 10) + "px");
     })
     .on("mouseout", function() {
        tooltip.style("display", "none");
     });
}

// Function to reset all points and clear text
function showAllPoints(svg, points, babelTextToColor) {
  svg.selectAll("circle")
     .attr("fill", function(d) {
       return babelTextToColor[d.labels[0]] || "gainsboro"; // Use the first label's color or default to grey
     });

  d3.select("#babelTexts").text("");
  d3.select("#humanml3dTexts").text("");
}

// Putting It All Together
d3.json("/assets/data/clean_babel_humanml3d_kitml_embedding.json").then(function(data) {
  var numAnnotations = 1000;  // Default number of annotations

  function updateVisualization(numAnnotations) {
    var result = processData(data, numAnnotations);
    points = result.points;  // Update global points variable

    // Remove the old SVG if it exists and recreate it
    d3.select("#embedding_viz").select("svg").remove();
    var { svg, xScale, yScale } = createSvgAndScales(800, 600, { top: 20, right: 20, bottom: 60, left: 70 }, points);

    // Clear and repopulate dropdowns
    d3.select("#babelDropdown").html("");
    d3.select("#humanml3dDropdown").html("");
    var { babelDropdown, humanml3dDropdown } = createDropdowns(result.babelTextList, result.humanml3dTextList);

    var tooltip = createTooltip();
    drawPoints(svg, points, xScale, yScale, tooltip);
    setupDropdownHandlers(svg, points, result.babelTextToColor, babelDropdown, humanml3dDropdown);
  }

  // Initial load with default annotations
  updateVisualization(numAnnotations);

  // Load annotations based on user input
  d3.select("#loadAnnotations").on("click", function() {
    numAnnotations = +document.getElementById("numAnnotations").value;
    updateVisualization(numAnnotations);
  });

  // Show all points when the "Show All Points" button is clicked
  d3.select("#showAllPoints").on("click", function() {
    showAllPoints(d3.select("#embedding_viz").select("svg"), points, assignColors(Array.from(new Set(points.map(p => p.labels.flat())))));
  });
});
