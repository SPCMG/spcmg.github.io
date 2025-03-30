function processData(data, numAnnotations, elementId) {
  var points = [];
  var humanml3dTexts = new Set();
  var tempBabelTexts = new Set();
  var counter = 0; // track number of processed annotations

  for (var seqKey in data) {
    if (counter >= numAnnotations) break; // stop if we have enough
    var sequence = data[seqKey];
    var annotations = sequence.annotations;

    // 1) Gather all Babel text in this sequence
    var babelTextsInSequence = [];
    annotations.forEach(function(annotation) {
      if (annotation.seg_id.startsWith("babel_")) {
        tempBabelTexts.add(annotation.text);
        babelTextsInSequence.push(annotation.text);
      }
    });

    // 2) Now loop again to capture both Babel and HumanML3D embeddings
    annotations.forEach(function(annotation) {
      // Make sure we don't exceed numAnnotations for the *HumanML3D* points
      // (If you also want to limit Babel points, you can check that as well)
      if (counter >= numAnnotations) return;

      // Determine if it's a Babel annotation or HumanML3D annotation
      var isBabel = annotation.seg_id.startsWith("babel_");
      var isHumanML3D = annotation.seg_id.startsWith("humanml3d_");

      // Identify correct embedding key (if you have special keys, adjust here)
      // Assuming the field is always "text_embedding_2d"
      var embedding = annotation.text_embedding_2d;

      if (embedding) {
        // We color this annotation by the "first" Babel text, if any
        // (If there's more than one, you might do something else)
        let colorLabel = (babelTextsInSequence.length > 0) 
                         ? babelTextsInSequence[0] 
                         : "NoBabelText";

        let shape = (isBabel) ? "star" : "circle";

        // Create a point object
        let point = {
          x: embedding[0],
          y: embedding[1],
          text: annotation.text,
          // Store array of *all* Babel texts in the same sequence
          // (so we can filter if needed)
          labels: babelTextsInSequence.slice(),
          colorLabel: colorLabel,   // used for coloring
          shape: shape
        };

        points.push(point);

        // If it's HumanML3D, then increment your annotation counter
        if (isHumanML3D) {
          humanml3dTexts.add(annotation.text);
          counter++;
        }
      }
    });
  }

  // Convert sets to arrays
  var babelTextList = Array.from(tempBabelTexts);
  var humanml3dTextList = Array.from(humanml3dTexts);

  // Create a color assignment for each unique Babel text
  var babelTextToColor = assignColors(babelTextList);

  return { points, babelTextList, humanml3dTextList, babelTextToColor };
}
// Generate Distinct Colors Function
function generateDistinctColors(n) {
  var colors = [];
  var saturation = 0.65;
  var lightness = 0.55;

  for (var i = 0; i < n; i++) {
    var hue = (i * 137.508) % 360; // Golden angle
    colors.push(d3.hsl(hue, saturation, lightness).toString());
  }
  return colors;
}

// Assign Colors Function
function assignColors(textList) {
  textList.sort();
  var n = textList.length;
  var colorPalette = generateDistinctColors(n);
  var textToColor = {};

  textList.forEach(function(text, index) {
    textToColor[text] = colorPalette[index];
  });
  return textToColor;
}

// Visualization Setup
function createSvgAndScales(width, height, margin, points, elementId) {
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

  var svg = d3.select(`#${elementId}`)
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
function createDropdowns(babelTextList, humanml3dTextList, elementId) {
  // Max length for the dropdown text
  var maxLength = 100;

  var babelDropdown = d3.select(`#babelDropdown${elementId}`).append("select").attr("id", "babelSelect");
  var humanml3dDropdown = d3.select(`#humanml3dDropdown${elementId}`).append("select").attr("id", "humanml3dSelect");

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
function setupDropdownHandlers(svg, points, babelTextToColor, babelDropdown, humanml3dDropdown, elementId) {
  babelDropdown.on("change", function() {
    var selectedBabelText = this.value;
    d3.select(`#humanml3dTexts${elementId}`).text("");  // Clear previous HumanML3D texts
    d3.select(`#babelTexts${elementId}`).text("");      // Clear previous BABEL texts

    if (selectedBabelText === "") {
      svg.selectAll("circle")
         .attr("fill", function(d) {
           return babelTextToColor[d.labels[0]] || "grey";
         });
      return;
    }

    var correspondingHumanml3dTexts = points.filter(function(d) {
      return d.labels.includes(selectedBabelText);
    }).map(function(d) {
      return d.humanml3d_text;
    });

    correspondingHumanml3dTexts = Array.from(new Set(correspondingHumanml3dTexts)); // Remove duplicates

    d3.select(`#humanml3dTexts${elementId}`).html("Corresponding HumanML3D Texts:<br>" +
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
    d3.select(`#babelTexts${elementId}`).text("");
    d3.select(`#humanml3dTexts${elementId}`).text("");

    if (selectedHumanml3dText === "") {
      svg.selectAll("circle")
         .attr("fill", function(d) {
           return babelTextToColor[d.labels[0]] || "grey";
         });
      return;
    }

    var correspondingBabelTexts = points.filter(function(d) {
      return d.humanml3d_text === selectedHumanml3dText;
    }).map(function(d) {
      return d.labels;
    });

    correspondingBabelTexts = Array.from(new Set([].concat.apply([], correspondingBabelTexts))); // Flatten and remove duplicates

    d3.select(`#babelTexts${elementId}`).html("Corresponding BABEL Texts:<br>" +
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
function drawPoints(svg, points, xScale, yScale, tooltip, elementId, babelTextToColor) {
  // Define a base symbol generator. We'll change .type() on the fly.
  var symbolGenerator = d3.symbol().size(80);

  svg.selectAll(".pointSymbol")
     .data(points)
     .enter()
     .append("path")
     .attr("class", "pointSymbol")
     .attr("transform", function(d) {
       return `translate(${xScale(d.x)}, ${yScale(d.y)})`;
     })
     .attr("d", function(d) {
       // We switch shape depending on whether it's Babel or HumanML3D
       if (d.shape === "star") {
         symbolGenerator.type(d3.symbolStar);
       } else {
         symbolGenerator.type(d3.symbolCircle);
       }
       return symbolGenerator();
     })
     // Fill color depends on the Babel text
     .attr("fill", function(d) {
       // Each point has .colorLabel which is the Babel text
       return babelTextToColor[d.colorLabel] || "gray";
     })
     .on("mouseover", function(event, d) {
       tooltip.style("display", "block");
       let correspondingBabelTexts = d.labels.join(", ");
       var content = `
         <strong>${elementId} embedding 2d:</strong> (${d.x.toFixed(2)}, ${d.y.toFixed(2)})<br>
         <strong>Text:</strong> ${d.text}<br>
         <strong>Babel Text(s):</strong> ${correspondingBabelTexts}
       `;
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
function showAllPoints(svg, babelTextToColor, elementId) {
  svg.selectAll("circle")
     .attr("fill", function(d) {
       return babelTextToColor[d.labels[0]] || "transparent";  // "gainsboro"; // Use the first label's color or default to grey
     });

  d3.select(`#babelTexts${elementId}`).text("");
  d3.select(`#humanml3dTexts${elementId}`).text("");
}

function processEmbedding(jsonPath, elementId, numAnnotations = 1000) {
  var points;
  d3.json(jsonPath).then(function(data) {
    function updateVisualization(numAnnotations, elementId) {
      var result = processData(data, numAnnotations, elementId);
      points = result.points;

      // Remove the old SVG if it exists and recreate it
      d3.select(`#${elementId}`).select("svg").remove();
      var { svg, xScale, yScale } = createSvgAndScales(800, 800, { top: 20, right: 20, bottom: 60, left: 60 }, points, elementId);

      // Clear and repopulate dropdowns
      d3.select(`#humanml3dDropdown${elementId}`).html("");  // First dropdown
      d3.select(`#babelDropdown${elementId}`).html("");  // Second dropdown

      var { babelDropdown, humanml3dDropdown } = createDropdowns(result.babelTextList, result.humanml3dTextList, elementId);

      var tooltip = createTooltip();
      drawPoints(svg, points, xScale, yScale, tooltip, elementId, result.babelTextToColor);
      setupDropdownHandlers(svg, points, result.babelTextToColor, babelDropdown, humanml3dDropdown, elementId);

      // Show all points when the "Show All Points" button is clicked
      d3.select(`#showAllPoints${elementId}`).on("click", function() {
        showAllPoints(svg, result.babelTextToColor, elementId);
      });
    }

    // Initial load with default annotations
    updateVisualization(numAnnotations, elementId);

    // Load annotations based on user input
    d3.select(`#loadAnnotations${elementId}`).on("click", function() {
      numAnnotations = +document.getElementById(`numAnnotations${elementId}`).value;
      updateVisualization(numAnnotations, elementId);
    });
  });
}

// Initialize the visualization for both datasets
processEmbedding("/assets/data/babel_humanml3d_with_CLIP_embeddings.json", "CLIP", 1000);
processEmbedding("/assets/data/babel_humanml3d_with_LaCLIP_embeddings.json", "LaCLIP", 1000);
processEmbedding("/assets/data/babel_humanml3d_with_DistilBERT_embeddings.json", "DistilBERT", 1000);
processEmbedding("/assets/data/clip_embeddings_of_humanml3d_babel_group.json", "ClipBabelGroup", 1000);
processEmbedding("/assets/data/babel_humanml3d_laclip_embedding.json", "LaClip", 1000);


//---------------------------------------------------------------------------------------------------
// Assign Colors to Annotations Groups
function assignColorsToAnnotations(annotationGroups) {
  var n = annotationGroups.length;
  var colorPalette = generateDistinctColors(n);
  var annotationToColor = {};

  annotationGroups.forEach(function(annotationGroup, index) {
    // Each annotation group gets a unique color
    annotationToColor[annotationGroup] = colorPalette[index];
  });

  return annotationToColor;  // Return the mapping of annotation groups to colors
}

// Process and plot annotations and their points
function processAndPlotAnnotations(data, numAnnotations, elementId) {
  var points = [];
  var annotationGroups = Object.keys(data);  // Get all annotation groups
  var annotationColors = assignColorsToAnnotations(annotationGroups);  // Assign unique colors to each group
  var counter = 0;

  // Loop through each sequence in the data
  annotationGroups.forEach(function(seqKey) {
    if (counter >= numAnnotations) return; // Stop processing after reaching numAnnotations

    var sequence = data[seqKey];
    var annotations = sequence.annotations;

    // Loop through each annotation in the sequence and collect '_embedding_2d' points
    annotations.forEach(function(annotation) {
      if (annotation.seg_id.startsWith('humanml3d_')) {
        var embeddingKey = elementId.replace("Group", "").toLowerCase() + '_embedding_2d';
        var embedding = annotation[embeddingKey];

        if (embedding) {
          var point = {
            x: embedding[0],
            y: embedding[1],
            humanml3dText: annotation.text,
            annotationGroup: seqKey // Track the group (sequence)
          };
          points.push(point);
        }
      }
    });

    counter++;
  });

  // Create the scales and plot the data
  var tooltip = createTooltip(); 
  createSvgAndPlot(points, elementId, tooltip, annotationColors);
}

// Plot the points with assigned colors and tooltips
function createSvgAndPlot(points, elementId, tooltip, annotationColors) {
  var width = 800, height = 800;
  var margin = { top: 20, right: 20, bottom: 60, left: 60 };

  // Calculate extents for both axes
  var xExtent = d3.extent(points, function(d) { return d.x; });
  var yExtent = d3.extent(points, function(d) { return d.y; });

  // Determine the maximum absolute value to ensure equal scaling on both axes
  var maxExtent = Math.max(Math.abs(xExtent[0]), Math.abs(xExtent[1]), Math.abs(yExtent[0]), Math.abs(yExtent[1]));

  // Create the same scale for both x and y to ensure equal unit intervals
  var xScale = d3.scaleLinear()
                 .domain([-maxExtent, maxExtent])
                 .range([margin.left, width - margin.right]);

  var yScale = d3.scaleLinear()
                 .domain([-maxExtent, maxExtent])
                 .range([height - margin.bottom, margin.top]);

  // Clear the previous SVG if exists
  d3.select(`#${elementId}`).select("svg").remove();

  var svg = d3.select(`#${elementId}`).append("svg")
              .attr("width", width)
              .attr("height", height);

  // Create x and y axes
  var xAxis = d3.axisBottom(xScale);
  var yAxis = d3.axisLeft(yScale);

  // Append the x-axis at y = 0 (cross the origin)
  svg.append("g")
     .attr("transform", `translate(0,${yScale(0)})`)  // Position x-axis at y = 0
     .call(xAxis);

  // Append the y-axis at x = 0 (cross the origin)
  svg.append("g")
     .attr("transform", `translate(${xScale(0)},0)`)  // Position y-axis at x = 0
     .call(yAxis);

  // Plot the points with color assignment and tooltip logic
  svg.selectAll("circle")
     .data(points)
     .enter()
     .append("circle")
     .attr("cx", function(d) { return xScale(d.x); })
     .attr("cy", function(d) { return yScale(d.y); })
     .attr("r", 5)
     .attr("fill", function(d) {
        return annotationColors[d.annotationGroup];  // Assign color based on the group
     })
     .on("mouseover", function(event, d) {
        tooltip.style("display", "block");  // Show tooltip on hover
     })
     .on("mousemove", function(event, d) {
        // Display humanml3dText in the tooltip
        tooltip.html(
          `<strong>${elementId.replace("Group", "").toLowerCase()} Embedding 2D:</strong> (${d.x.toFixed(2)}, ${d.y.toFixed(2)})<br>` +
          `<strong>HumanML3D Text:</strong> ${d.humanml3dText}`
        )
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
     })
     .on("mouseout", function() {
        tooltip.style("display", "none");  // Hide the tooltip when the mouse leaves
     });
}

// Function to handle loading annotations for the dataset
function processAnnotationsEmbedding(jsonPath, elementId, numAnnotations = 100) {
  d3.json(jsonPath).then(function(data) {
    processAndPlotAnnotations(data, numAnnotations, elementId);
  });

  d3.select(`#loadAnnotations${elementId}`).on("click", function() {
    numAnnotations = +document.getElementById(`numAnnotations${elementId}`).value;
    d3.json(jsonPath).then(function(data) {
      processAndPlotAnnotations(data, numAnnotations, elementId);
    });
  });
}

// Call the function for each dataset
// processAnnotationsEmbedding("/assets/data/clip_embeddings_of_humanml3d.json", "ClipGroup", 100);
// processAnnotationsEmbedding("/assets/data/t2m_embeddings_of_humanml3d.json", "T2mGroup", 100);


//---------------------------------------------------------------------------------------------------
// Process the data and create a visualization for original vs swapped embeddings
function processSwappedEmbedding(data, numAnnotations, elementId) {
  var points = [];
  var counter = 0;

  // Limit the number of pairs to numAnnotations
  for (var i = 0; i < data.length; i++) {
    if (counter >= numAnnotations) break;

    var pair = data[i];

    points.push({
      x: pair.original_embedding_2d[0],
      y: pair.original_embedding_2d[1],
      type: 'original',
      description: pair.original_description,
      pair_description: pair.swapped_description,
      euclidean_distance: pair.euclidean_distance
    });

    points.push({
      x: pair.swapped_embedding_2d[0],
      y: pair.swapped_embedding_2d[1],
      type: 'swapped',
      description: pair.swapped_description,
      pair_description: pair.original_description,
      euclidean_distance: pair.euclidean_distance
    });

    counter++;
  }

  // Create the scales and plot the data
  var tooltip = createTooltip(); 
  createSvgAndPlotSwapped(points, tooltip, elementId);
}

// Create and plot the data points with hover functionality, axes, and color by pair
function createSvgAndPlotSwapped(points, tooltip, elementId) {
  var width = 800, height = 800;
  var margin = { top: 20, right: 20, bottom: 60, left: 60 };

  var xExtent = d3.extent(points, function(d) { return d.x; });
  var yExtent = d3.extent(points, function(d) { return d.y; });

  var maxExtent = Math.max(Math.abs(xExtent[0]), Math.abs(xExtent[1]), Math.abs(yExtent[0]), Math.abs(yExtent[1]));

  var xScale = d3.scaleLinear()
                 .domain([-maxExtent * 1.1, maxExtent * 1.1]) // Ensure x and y scales are symmetric
                 .range([margin.left, width - margin.right]);

  var yScale = d3.scaleLinear()
                 .domain([-maxExtent * 1.1, maxExtent * 1.1]) // Same scale for y-axis
                 .range([height - margin.bottom, margin.top]);

  // Clear the previous SVG if exists
  d3.select(`#${elementId}`).select("svg").remove();

  var svg = d3.select(`#${elementId}`).append("svg")
              .attr("width", width)
              .attr("height", height);

  // Create x and y axes
  var xAxis = d3.axisBottom(xScale);
  var yAxis = d3.axisLeft(yScale);

  svg.append("g")
     .attr("transform", `translate(0,${yScale(0)})`)
     .call(xAxis);

  svg.append("g")
     .attr("transform", `translate(${xScale(0)},0)`)
     .call(yAxis);

  // Create color scale for pairs
  var colorScale = generateDistinctColors(points.length / 2);

  // Plot the points
  svg.selectAll("circle")
  .data(points)
  .enter()
  .append("circle")
  .attr("cx", function(d) { return xScale(d.x); })
  .attr("cy", function(d) { return yScale(d.y); })
  .attr("r", 5)
  .attr("fill", function(d, i) { return colorScale[Math.floor(i / 2)]; })  // Use the same color for each pair
  .on("mouseover", function(event, d) {
    tooltip.style("display", "block");

    // Conditional display logic
    var tooltipContent = '';
    if (d.type === 'swapped') {
      tooltipContent = `
        <strong>Coordinates (x, y):</strong> (${d.x.toFixed(3)}, ${d.y.toFixed(3)})<br>
        <strong>Swapped Description:</strong> ${d.description}<br>
        <strong>Euclidean Distance to Original:</strong> ${d.euclidean_distance.toFixed(3)}
      `;
    } else {
      tooltipContent = `
        <strong>Coordinates (x, y):</strong> (${d.x.toFixed(3)}, ${d.y.toFixed(3)})<br>
        <strong>Original Description:</strong> ${d.description}<br>
        <strong>Euclidean Distance to Swapped:</strong> ${d.euclidean_distance.toFixed(3)}
      `;
    }

    tooltip.html(tooltipContent)
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

// Function to handle loading swapped annotations for the CLIP dataset
function processClipSwappedEmbedding(jsonPath, elementId, numAnnotations = 10) {
  d3.json(jsonPath).then(function(data) {
    processSwappedEmbedding(data, numAnnotations, elementId);
  });

  d3.select(`#loadAnnotations${elementId}`).on("click", function() {
    numAnnotations = +document.getElementById(`numAnnotations${elementId}`).value;
    d3.json(jsonPath).then(function(data) {
      processSwappedEmbedding(data, numAnnotations, elementId);
    });
  });
}

processClipSwappedEmbedding("/assets/data/clip_swapped_actions_embeddings.json", "ClipSwapped", 10);
processClipSwappedEmbedding("/assets/data/t2m_swapped_actions_embeddings.json", "T2mSwapped", 10);
