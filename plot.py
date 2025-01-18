import matplotlib.pyplot as plt
import numpy as np

# Data
actions = [
    "walk", "walk", "walk", "walk", 
    "walk, jump", "walk, jump", "walk, jump", "walk, jump", 
    "jump", "jump", "jump"
]
x_coords = [
    -1.32017946243286, -0.772716284, 1.495050554, -0.854718328, 
    -0.394048899, 1.930614471, -0.236513079, -1.136059761, 
    -1.857286215, -0.813261318, -0.372564405
]
y_coords = [
    -0.962910592555999, -2.306731701, -2.139530659, -0.974266708, 
    -1.257809162, -1.644743434, -1.698970318, -1.424935818, 
    0.481309354, 0.708792029, -0.137964159
]

# Create the scatter plot
plt.figure(figsize=(10, 6))
unique_actions = list(set(actions))
colors = plt.cm.tab10(range(len(unique_actions)))

# Plot each group with a unique color and add trendlines
for action, color in zip(unique_actions, colors):
    indices = [i for i, a in enumerate(actions) if a == action]
    x_group = [x_coords[i] for i in indices]
    y_group = [y_coords[i] for i in indices]
    
    # Scatter points for the group
    plt.scatter(x_group, y_group, label=action, color=color)
    
    # Add a trendline for each group
    if len(x_group) > 1:  # Trendline needs at least 2 points
        coef = np.polyfit(x_group, y_group, 1)  # Fit a linear regression
        trendline = np.poly1d(coef)
        plt.plot(x_group, trendline(x_group), linestyle='--', color=color)

# Add labels, legend, and grid
plt.title("Scatter Plot with Trendlines Grouped by Action")
plt.xlabel("X-coordinate")
plt.ylabel("Y-coordinate")
plt.legend(title="Action")
plt.grid(True)
plt.show()
