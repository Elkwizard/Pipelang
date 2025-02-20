evalStat(`
GRAPH_ASPECT_RATIO = 7 / 8;
GraphOperation = operator(2);
Graph = GraphOperation();

graphContinuation = [
	operator op = op
		|> operands
		|> prepend Graph
		|> createOperator [
			operator() ops = ops
				|> first
				|> unwrap
				|> concat unwrapCall(tail(ops), op)
		]
		|> withOverload op
];

graphPrimitive = [
	String name, type() types = types
		|> createOperator [
			operator() ops = { { [= name], [= ops] } }
		]
		|> graphContinuation
];

// primitives
color = [
	real w = color(w, w, w)
] & [
	real r, real g, real b, real a: 1 = { r, g, b, a }
];
graphXAxis = "xaxis" |> graphPrimitive { Object };
graphYAxis = "yaxis" |> graphPrimitive { Object };
graphGrid = "grid" |> graphPrimitive { };
graphText = "text" |> graphPrimitive { String, real(2) };
graphRect = "rect" |> graphPrimitive { real(2), real(2) };
graphPoint = "point" |> graphPrimitive { real(2) };
graphLine = "line" |> graphPrimitive { real(2), real(2) };
graphPixels = "pixels" |> graphPrimitive { real(4)()(), real(2) };
graphTitle = "title" |> graphPrimitive { String };

// settings
graphColor = "color" |> graphPrimitive { real() };
graphDash = "dash" |> graphPrimitive { real() };
graphLineWidth = "linewidth" |> graphPrimitive { real };
graphPolygon = "polygon" |> graphPrimitive { real(2)() };

graphBase = graphContinuation([
	real marks: true = graphGrid()
		|> graphXAxis { marks: }
		|> graphYAxis { marks: }
]);

graphTitles = graphContinuation([
	String title, String xTitle: "", String yTitle: "" = graphTitle(title)
		|> graphXTitle xTitle
		|> graphYTitle yTitle
]);

graphLines = graphContinuation([
	real(2)() points = rangeTo(len(points) - 1)
		|> [real inx = { points(inx), points(inx + 1) }]
		|> [real(2)(2) line = graphLine(line(0), line(1)) |> first]
]);

GRAPH_FUNCTION_RESOLUTION = 300;
getFunctionGraphPoints = [
	operator fn, real(2) domain = domain(1)
		|> - domain(0)
		|> is span
		|> reciprocal
		|> * GRAPH_FUNCTION_RESOLUTION
		|> subRange span
		|> + domain(0)
		|> [real x = { x, fn(x) }]
];

graphArea = graphContinuation([
	operator fn, real(2) domain = fn
		|> getFunctionGraphPoints domain
		|> [
			real()(2) points = { { domain(0), 0 } }
				|> concat points
				|> concat { { domain(1), 0 } }
		]
		|> graphPolygon
]);

CHART_BAR_WIDTH = 0.7;

graphBarChart = graphContinuation([
	real(2)() points, String() names, String yTitle =
		bins = points
			|> axis 0
			|> unique
			|> sort;
		namePadding = names
			|> map len
			|> sum
			|> [100 - $]
			|> / $(len(names) + 2)
			|> round
			|> [repeat(' ', $)];
		bars = bins
			|> [
				real x = 

					data = points
						|> filter [$(0) == x]
						|> axis 1;
					height = mean(data);
					stdErr = data
						|> sampStdDev
						|> stdDevXBar len(data);
					diagonal = { CHART_BAR_WIDTH, height } * 0.5;
					center = { x + 1, height * 0.5 };
					color = rangeTo(3)
						|> fill random
						|> append 1;
					{}
						|> concat graphColor(color)
						|> concat graphRect(center - diagonal, center + diagonal)
						|> concat graphColor({ 0, 0, 0, 1 })
						|> concat graphErrorBar(
							{ center(0), height }, { 0, 1 },
							stdErr, CHART_BAR_WIDTH * 0.5
						)
			]
			|> reduce concat
			|> graphXTitle join(names, namePadding)
			|> graphYTitle yTitle
]);

graphHistogram = graphContinuation([
	real() data, real bins =
		min = minAll(data);
		max = maxAll(data);
		binSize = (max - min) / bins;
		gap = binSize * 0.05;
		bins
			|> rangeTo
			|> * binSize
			|> + roundTo(min, binSize, floor)
			|> [real bin = { bin, bin + binSize }]
			|> [
				real(2) bin = 
					height = data
						|> filter [bin |> contains $]
						|> len;
					
					graphRect(
						{ bin(0) + gap, 0 },
						{ bin(1) - gap, height }
					)
			]
			|> flat
]);

graphFunction = graphContinuation([
	operator fn, real(2) domain = fn
		|> getFunctionGraphPoints domain
		|> graphLines
]);

graphPoints = graphContinuation([
	real(2)() points = points
		|> [
			real(2) point = point
				|> graphPoint
				|> first
		]
]);

graphCappedBar = graphContinuation([
	real(2) a, real(2) b, real width =
		caps = b - a
			|> rightNormal
			|> normalize
			|> * width
			|> / 2
			|> both -;
		{ a, b }
			|> [
				real(2) end = end
					|> + caps
					|> call graphLine
			]
			|> flat
			|> graphLine a b;
]);

graphErrorBar = graphContinuation([
	real(2) p, real(2) ax, real u, real barWidth = ax
		|> * max(1e-9, u)
		|> both -
		|> + p
		|> call [
			real(2) a, real(2) b = graphCappedBar(a, b, barWidth)
		]
]);

graphErrorBars = graphContinuation([
	real(2) point, real(2) errors, real(2) barWidth = point
		|> graphErrorBar identityMatrix(2) errors barWidth
		|> flat
]) & graphContinuation([
	real(2)() points, real(2)() errors = 
		barWidth = points
			|> zip
			|> range
			|> reverse
			|> * 0.03;
		points
			|> graphErrorBars errors barWidth
			|> flat;
]);

graphRegression = graphContinuation([
	real(2)() points, operator model = graphPoints(points)
		|> concat graphColor({ 1, 0, 1, 1 })
		|> concat graphFunction(model, {
			minAll(axis(points, 0)),
			maxAll(axis(points, 0))
		})
]);

graphExperiment = [
	real()() data, String xTitle, String yTitle, real(2) { errX, errY } =
		x = data(0);
		ys = data
			|> tail
			|> zip;
		y = mean(ys);
		errors = ys
			|> sampStdDev
			|> max errY
			|> [real errY = { errX, errY }];
		points = zip({ x, y });
		model = linReg(points);
		graphBase()
			|> graphTitles $(yTitle # " vs. " # xTitle) xTitle yTitle
			|> graphColor color(0.5)
			|> graphErrorBars points errors
			|> graphColor color(0)
			|> graphRegression points model
			|> display;
		model
];

graphNormalProbability = graphContinuation([
	real() x = x
		|> len
		|> is n
		|> rangeTo
		|> + 0.5
		|> / n
		|> invNorm 0 1
		|> [real() prct = zip({ sort(x), prct })]
		|> is points
		|> graphRegression linReg(points)
]);

graph = [
	real(2)() points = graphBase()
		|> graphPoints points
		|> display
] & [
	operator fn, real radius = graphBase()
		|> graphFunction fn both(radius, -)
		|> display
];
`);

currentScope["display"] = new Operator([
	[new Type("operator", [2, null]), "actions"]
], actions => {
	const PADDING = 40;
	const WIDTH = 400;
	const HEIGHT = WIDTH * currentScope["GRAPH_ASPECT_RATIO"];
	const canvas = document.createElement("canvas");
	canvas.width = (WIDTH + PADDING * 2) * devicePixelRatio;
	canvas.height = (HEIGHT + PADDING * 2) * devicePixelRatio;
	canvas.style.width = (canvas.width / devicePixelRatio) + "px";
	canvas.style.height = (canvas.height / devicePixelRatio) + "px";
	const c = canvas.getContext("2d");
	c.scale(devicePixelRatio, devicePixelRatio);
	c.translate(PADDING, PADDING);

	actions = actions.toArray().map(action => {
		const [name, settings] = action;
		const unwrapped = Operator.unwrap(settings).toArray().map(Operator.unwrap);
		return {
			action: Operator.unwrap(name).asString(),
			originalSettings: unwrapped,
			settings: unwrapped
					.map(element => element instanceof List ? element.toArray() : element)
		};
	});

	const BASE_FONT = "10px Arial";
	const AXIS_TITLE_FONT = `${PADDING * 0.4}px Arial`;
	const TITLE_FONT = `${PADDING * 0.6}px Arial`;
	const AXIS_TITLE_OFFSET = PADDING * 0.35;

	const defaultAxisConfig = color => ({
		marks: false,
		present: false,
		title: null,
		ticks: null,
		min: null,
		max: null,
		rangeSpecified: false,
		color
	});

	const axisConfig = {
		x: defaultAxisConfig([0, 1, 0]),
		y: defaultAxisConfig([1, 0, 0])
	};

	const points = [];
	let newActions = [];
	for (const step of actions) {
		const { action, settings, originalSettings } = step;
		let remove = false;
		switch (action) {
			case "rect":
			case "line":
			case "point":
				points.push(...settings);
				break;
			case "polygon":
				points.push(...settings[0]);
				break;
			case "pixels": {
				const [colors, pos] = settings;
				points.push(pos);
				points.push([pos[0] + colors[0].length, pos[1] + colors.length]);
			}; break;
			case "xaxis":
			case "yaxis": { // add to config
				remove = true;
				const config = axisConfig[action[0]];
				config.present = true;
				for (const key in config) {
					const value = originalSettings[0].read(key);
					if (value === VOID) continue;
					if (key === "marks") {
						config.marks = !!value;
					} else if (key === "title" || key === "color") {
						if (!(value instanceof List)) continue;
						if (typeof value.elements[0] !== "number") continue;
						if (key === "title") {
							config.title = value.asString();
						} else {
							config.color = value.toArray();
						}
					} else if (key === "ticks") {
						if (typeof value !== "number") continue;
						config.ticks = value;
					} else if (key === "min" || key === "max") {
						if (typeof value !== "number") continue;
						config.rangeSpecified = true;
						config[key] = value;
					}
				}
			}; break;
		}
		if (!remove) newActions.push(step);
	}
	actions = newActions;

	const x = points.map(p => p[0]);
	const y = points.map(p => p[1]);
	let minX = axisConfig.x.min ?? Math.min(...x);
	let maxX = axisConfig.x.max ?? Math.max(...x);
	let minY = axisConfig.y.min ?? Math.min(...y);
	let maxY = axisConfig.y.max ?? Math.max(...y);
	let spanX = maxX - minX;
	let spanY = maxY - minY;

	const paddingX = axisConfig.x.rangeSpecified ? 0 : spanX * 0.1;
	const paddingY = axisConfig.y.rangeSpecified ? 0 : spanY * 0.1;
	minX -= paddingX;
	maxX += paddingX;
	minY -= paddingY;
	maxY += paddingY;
	spanX = maxX - minX;
	spanY = maxY - minY;

	const integer = number => {
		const pow10 = 10 ** Math.floor(Math.log10(number));
		const ratio = Math.round(number / pow10);
		const complete = pow10 * ratio;
		return complete;
	};

	const xScale = axisConfig.x.ticks ?? integer(spanX / 10);
	const yScale = axisConfig.y.ticks ?? integer(spanY / 10);

	const prettify = number => {
		return String(number)
			.replace(/(\d+)\.9*$/, (_, n) => +n + 1)
			.replace(/(\d)9{8,}\d{0,2}$/g, (_, n) => +n + 1)
			.replace(/0{8,}\d{0,2}$/g, "");
	};

	minX = Math.floor(minX / xScale) * xScale;
	maxX = Math.ceil(maxX / xScale) * xScale;
	minY = Math.floor(minY / yScale) * yScale;
	maxY = Math.ceil(maxY / yScale) * yScale;
	spanX = maxX - minX;
	spanY = maxY - minY;

	const mapX = x => (x - minX) / spanX * WIDTH;
	const mapY = y => (1 - (y - minY) / spanY) * HEIGHT;
	
	const LABEL_OFFSET = 3;

	const Y_AXIS_X = Math.max(minX, Math.min(maxX, 0));
	const X_AXIS_Y = Math.max(minY, Math.min(maxY, 0));

	const parseString = string => typeof string === "string" ? string : String.fromCharCode(...string);

	const plot = {
		line([x1, y1], [x2, y2]) {
			x1 = mapX(x1);
			x2 = mapX(x2);
			y1 = mapY(y1);
			y2 = mapY(y2);
	
			c.beginPath();
			c.moveTo(x1, y1);
			c.lineTo(x2, y2);
			c.stroke();	
		},
		point([x, y]) {
			c.beginPath();
			c.arc(mapX(x), mapY(y), 2, 0, Math.PI * 2);
			c.stroke();
		},
		rect([minX, minY], [maxX, maxY]) {
			minX = mapX(minX);
			minY = mapY(minY);
			maxX = mapX(maxX);
			maxY = mapY(maxY);

			c.fillRect(minX, minY, maxX - minX, maxY - minY);
		},
		color([r = 0, g = 0, b = 0, a = 1] = []) {
			const color = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
			c.strokeStyle = color;
			c.fillStyle = color;
		},
		dash(dash) {
			c.setLineDash(dash);
		},
		linewidth(width) {
			c.lineWidth = width;
		},
		polygon(points) {
			points = points.map(([x, y]) => [mapX(x), mapY(y)]);
			c.beginPath();
			c.moveTo(...points[0]);
			for (const [x, y] of points.slice(1))
				c.lineTo(x, y);
			c.lineTo(...points[0]);
			c.fill();
		},
		title(message) {
			c.font = TITLE_FONT;
			c.textAlign = "center";
			c.fillText(parseString(message), WIDTH / 2, -AXIS_TITLE_OFFSET);
			c.textAlign = "start";
		},
		xtitle() {
			const message = axisConfig.x.title;
			if (!message) return;
			c.font = AXIS_TITLE_FONT;
			c.textAlign = "center";
			c.fillText(parseString(message), WIDTH / 2, HEIGHT + PADDING * 0.7);
			c.textAlign = "start";
		},
		ytitle() {
			const message = axisConfig.y.title;
			if (!message) return;
			c.save();
			c.translate(-AXIS_TITLE_OFFSET, HEIGHT / 2);
			c.rotate(-Math.PI / 2);
			c.font = AXIS_TITLE_FONT;
			c.textAlign = "center";
			c.fillText(parseString(message), 0, 0);
			c.restore();
		},
		xaxis() {
			this.color(axisConfig.x.color);
			this.line([minX, X_AXIS_Y], [maxX, X_AXIS_Y]);
			if (axisConfig.x.marks) {
				for (let i = minX; i < maxX; i += xScale) {
					c.fillText(prettify(i), mapX(i) + LABEL_OFFSET, mapY(X_AXIS_Y) - LABEL_OFFSET);
				}
			}
			this.color();
		},
		yaxis() {
			this.color(axisConfig.y.color);
			this.line([Y_AXIS_X, minY], [Y_AXIS_X, maxY]);
			if (axisConfig.y.marks) {
				for (let i = minY; i < maxY; i += yScale) {
					c.fillText(prettify(i), mapX(Y_AXIS_X) + LABEL_OFFSET, mapY(i) - LABEL_OFFSET);
				}
			}
			this.color();
		},
		grid() {
			this.dash([]);
			this.linewidth(1);
			this.color([0.8, 0.8, 0.9]);
			for (let i = minX; i < maxX; i += xScale) for (let j = minY; j < maxY; j += yScale) {
				const x = mapX(i);
				const y = mapY(j);
				const width = mapX(i + xScale) - x;
				const height = mapY(j + yScale) - y;
				c.strokeRect(x, y, width, height);
			}
			this.color();
		},
		text(chars, [x, y]) {
			c.font = BASE_FONT;
			c.fillText(parseString(chars), x, y);
		},
		pixels(colors, [minX, minY]) {
			const width = colors[0].length;
			const height = colors.length;
			maxX = minX + width;
			maxY = minY + height;
			minX = mapX(minX);
			minY = mapY(minY);
			maxX = mapX(maxX);
			maxY = mapY(maxY);
			const imageData = new ImageData(
				new Uint8ClampedArray(colors.flat(Infinity).map(c => c * 255)),
				width, height
			);
			const surface = new OffscreenCanvas(width, height);
			surface.getContext("2d").putImageData(imageData, 0, 0);
			
			c.imageSmoothingEnabled = false;
			c.drawImage(surface, minX, minY, maxX - minX, maxY - minY);
		}
	};
	
	plot.color([1, 1, 1]);
	c.fillRect(-PADDING, -PADDING, WIDTH + PADDING * 2, HEIGHT + PADDING * 2);
	plot.color([0, 0, 0]);

	for (const { action, settings } of actions)
		plot[action]?.(...settings);

	if (axisConfig.x.present) {
		plot.xaxis();
		plot.xtitle();
	}

	if (axisConfig.y.present) {
		plot.yaxis();
		plot.ytitle();
	}

	logElement(canvas);
});

if (false) exec(`
	x = rangeTo(100) |> fill random;
	y = x |> fill random |> * 0.2 |> + x;
	points = zip({ x, y });
	graphBase()
		|> graphXAxis {title: "Words", ticks: 0.5, color: {1,0,0}}
		|> graphPoints points
		|> display;
`);

if (false) exec(`
	x = random 10;
	y = rangeTo 3
		|> fill [= x
			|> fill random
			|> * 3
			|> + $(2 * x)
		];
	error = { 0.01, 0.01 };
	graphExperiment "Force [N]" "Distance [m]" prepend(y, x) error;
`);

if (false) exec(`
	// data = (random(100) + random(100) + random(100)) * 0.333;
	data = random(100);
	graphBase(true)
		|> graphColor { 1, 0, 0 }
		|> graphYAxis { min: 0 }
		|> graphHistogram data 10
		|> display
`);

if (false) exec(`
// graphBase(true)
// 	|> concat graphFunction([real x = normalpdf x 0 1], { -6, 6 })
// 	|> graph;

// x = rangeTo(200)
// 	|> map random;

// y = rangeTo(200)
// 	|> map random
// 	|> * 0.2
// 	|> + x;

// points = zip { x, y };

// graphBase(true)
// 	|> concat graphRegression(points, linReg(points))
// 	|> graph;

Material = [
	real(4) color = [
		real(3) point, real(3) normal, real(3) ro, real(3) rd, real depth = point
			|> raytrace reflect(rd, normal) false +(depth, 1)
			|> is reflection
			|> primitive
			|> ? [= color] [= color
				|> lerp reflection 1
			]
	]
];

// shapes
Shape = [
	operator material, operator intersect, operator normal = {
		field("material", material),
		field("intersect", intersect),
		field("normal", normal)
	}
];

Sphere = [
	operator material, real(3) center, real radius = Shape material [
		real(3) ro, real(3) rd = center
			|> - ro
			|> is toCenter
			|> mag
			|> is distToCenter
			|> to toCenter
			|> / distToCenter
			|> is dirToCenter
			|> dot rd
			|> is similarity
			|> > 0
			|> ? [= similarity
				|> acos
				|> tan
				|> pow 2
				|> is slopeSquared
				|> + 1
				|> is a
				|> to slopeSquared
				|> * 2
				|> * distToCenter
				|> is b
				|> to slopeSquared
				|> * pow(distToCenter, 2)
				|> - pow(radius, 2)
				|> is c
				|> * a
				|> * 4
				|> * -1
				|> + pow(b, 2)
				|> is discriminant
				|> >= 0
				|> ? [= discriminant
					|> sqrt
					|> + b
					|> * -1
					|> / a
					|> / 2
					|> is x
					|> * distToCenter
					|> * 2
					|> + pow(radius, 2)
					|> + pow(distToCenter, 2)
					|> sqrt
				] [= Infinity]
			] [= Infinity]
	] [
		real(3) point = point
			|> - center
			|> normalize
	]
];

// scene
SCENE = {
	Sphere(Material({ 0.3, 0, 0, 1 }), { 0, 0, 0 }, 0.3),
	Sphere(Material({ 0.3, 0.8, 0, 1 }), { -0.5, -0.2, 1 }, 0.5),
	Sphere(Material({ 0.6, 0.3, 0.3, 1 }), { 1, 0, 1 }, 0.4),
	Sphere(Material({ 0.8, 0.8, 0.9, 1 }), { 0, -30, 10 }, 30)
};

// camera
lookAt = { 0, 0, 0 };
cameraPos = { 0, 1, -3 };
cameraForward = lookAt |> - cameraPos |> normalize;
cameraRight = cameraForward |> cross { 0, -1, 0 } |> normalize;
cameraUp = cameraRight |> cross cameraForward;
cameraMatrix = transpose { cameraRight, cameraUp, cameraForward };
focalLength = 0.2;
getRayDir = [
	real(2) p = concat p { 1 }
		|> - { 0, 0, -(0, focalLength) }
		|> normalize
		|> transformBy cameraMatrix
];

// light
Light = [
	real(3) position, real(3) color = {
		field("position", position),
		field("color", color)
	}
];

LIGHTS = {
	// Light({ 0, 4, 0 }, { 1, 1, 1 })
	Light({ 1, 2, 0 }, { 1, 0.9, 0.8 }),
	Light({ -1, 2, 0 }, { 0.5, 0.5, 1 }),
};

getLighting = [
	real(3) point, real(3) normal, real(3) ro, real(3) rd, real depth = LIGHTS
		|> [
			operator()(2) light = light
				|> read "position"
				|> is lightPos
				|> - point
				|> normalize
				|> is lightDir
				|> to point
				|> + *(normal, 0.04)
				|> raytrace lightDir true depth
				|> ? [= { 0, 0, 0 }] [= lightDir
					|> dot normal
					|> max 0
					|> is diffuse
					|> to lightDir
					|> dot rd
					|> * -1
					|> pow 16
					|> * 4.0
					|> is specular
					|> + diffuse
					|> * read(light, "color")
				]
		]
		|> zip
		|> sum
];

// render
BACKGROUND_COLOR = { 0.6, 0.9, 1, 1 };

MAX_DEPTH = 3;

raytrace = [
	real(3) ro, real(3) rd, real shadow, real depth = depth
		|> <= MAX_DEPTH
		|> ? [= SCENE
			|> [
				operator()(2) shape = shape
					|> read "intersect"
					|> [operator intersect = intersect ro rd]
			]
			|> is distances
			|> minAll
			|> is minDist
			|> isFinite
			|> ? [= shadow
				|> ? [= true] [= minDist
					|> findIn distances
					|> nthOf SCENE
					|> is hitShape
					|> to minDist
					|> * rd
					|> + ro
					|> is hitPoint
					|> to hitShape
					|> read "normal"
					|> [operator normal = normal(hitPoint)]
					|> is normal
					|> to {
						read(hitShape, "material")(hitPoint, normal, ro, rd, depth),
						concat(getLighting(hitPoint, normal, ro, rd, depth), { 1 })
					}
					|> zip
					|> product
				]
			] [= ? shadow [= false] [= BACKGROUND_COLOR]]
		] [= false]
];

getPixel = [
	real(2) coords = raytrace cameraPos getRayDir(coords) false 0
		|> is result
		|> primitive
		|> ? [= BACKGROUND_COLOR] [= result]
];

SCREEN_DIM = { 256, 256 } |> / 1 |> round;

screenCoords = rangeTo SCREEN_DIM(1)
	|> [
		real y = rangeTo SCREEN_DIM(0)
			|> [
				real x = { x, y }
					|> / SCREEN_DIM
					|> - 0.5
			]
	];


screenBuffer = getPixel screenCoords;

GRAPH_ASPECT_RATIO = 1;
graphPixels(screenBuffer, { 0, 0 }) |> display;
// graphBase(true) |> concat graphPixels(screenBuffer, { 0, 0 }) |> concat graphFunction([real x = normalpdf x 0 1 |> * 15], { -6, 6 }) |> display;
`);