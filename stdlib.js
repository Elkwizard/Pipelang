evalStat(`
// types
createType = [
	type baseType, real() dims = dims
		|> reduce baseType [
			type acc, real dim = (dim == -1 ? acc() : acc(dim))
		]
];
in = [
	any value, type cls = value
		|> typeOf
		|> convertibleTo cls
];

// operator manipulation
withOverload = [
	operator a, operator b = a & b
];
asOverloads = [
	operator() ops = ops
		|> reduce withOverload
];
of = [
	operator f, operator g = f
		|> operands
		|> createOperator [
			operator() ops = ops
				|> unwrapCall f
				|> g
		]
] & [
	operator f, g = f(g)
];
specify = [
	operator impl, type() signature = signature
		|> createOperator [
			operator() ops = ops
				|> unwrapCall impl
		]
];
flip = [
	operator op = op
		|> operands
		|> reverse
		|> createOperator [
			operator() ops = ops
				|> reverse
				|> unwrapCall op
		]
];
commute = [
	operator op = op & flip(op)
];

// simple operators
identity = [
	value = value
];
! = [
	real condition = condition
		|> == false
];
** &= [
	operator op, real exponent = 
		multiCall = [
			value, count = (count > 0 ? op(multiCall(value, count - 1)) : value)
		];
		op
			|> operands
			|> createOperator [
				operator() args = args
					|> first
					|> unwrap
					|> multiCall exponent
			]
];
^ = **;
!== = [
	any a, any b = a
		|> === b
		|> !
];
++ = [
	real number = number
		|> + 1
];
-- = [
	real number = number
		|> - 1
];
- &= [
	real number = 0 - number
];
/ &= [
	real number = 1 / number
];
?? = [
	void a, b = b
] & [
	a, b = a
];
random = random & [
	real length = length
		|> rangeTo
		|> fill random
];
indices = [
	any() list = list
		|> len
		|> rangeTo
];
reduce = [
	any() data, any base, operator combine = data
		|> len
		|> ? [= data(1:)
			|> reduce combine(base, data(0)) combine
		] [= base]
] & [
	any() data, operator combine = data(1:)
		|> reduce data(0) combine
];
zip = [
	any()() grid = grid
		|> len
		|> is rows
		|> to grid(0)
		|> len
		|> is columns
		|> rangeTo
		|> [
			real cIndex = rows
				|> rangeTo
				|> [
					real rIndex = grid(rIndex)(cIndex)
				]
		]
];
swap = [
	any() list, real i, real j = list
		|> indices
		|> [
			real index = index
				|> == { i, j }
				|> * { 2, 1 }
				|> sum
				|> nthOf { index, i, j, index }
				|> nthOf list
		]
];
flat = [
	any() arr, real depth: 1 = depth
		|> > 0
		|> ? [= arr
			|> reduce { } concat
			|> flat $(depth - 1)
		] [= arr]
];
repeat = [
	value, real count = count
		|> rangeTo
		|> [real index = value]
];
fill = [
	any() list, operator generate = list
		|> indices
		|> [real index = generate()]
];
nthOf = [
	real n, any() list = list(n)
];
map = [
	any() list, operator map = list
		|> indices
		|> [
			real index = index
				|> nthOf list
				|> map
		]
];
effect = [
	any value, operator sideEffect = value
		|> sideEffect
		|> to value
];
all = [
	real() conditions = conditions
		|> reduce true &&
];
some = [
	real() conditions = conditions
		|> reduce false ||
];
empty = [
	any() list = list
		|> len
		|> === 0
];
reverse = [
	any() list = list
		|> indices
		|> + 1
		|> map [list(-i)]
];
concat = [
	any() a, any() b = len(a) + len(b)
		|> is length
		|> ? [= length
			|> rangeTo
			|> map [i < len(a) ? a(i) : b(i - len(a))]
		] [= { }]
];
append = [
	any() a, any b = a
		|> concat { b }
];
prepend = [
	any() a, any b = { b }
		|> concat a
];
padStart = [
	any() list, real size, fillEl = size
		|> - len(list)
		|> rangeTo
		|> fill [= fillEl]
		|> concat list
];
padEnd = [
	any() list, real size, fillEl = size
		|> - len(list)
		|> rangeTo
		|> fill [= fillEl]
		|> [padding = concat(list, padding)]
];
roundTo = [
	real number, real digits = 10
		|> pow digits
		|> is size
		|> * number
		|> round
		|> / size
];
isNaN = [
	real n = n != n
];
isInteger = [
	real n = n - floor(n) == 0
];
isFinite = [
	real n = n - n == 0
];
even = [
	real n = n
		|> % 2
		|> == 0
];
odd = [
	real n = n
		|> even
		|> !
];
count = [
	any() list, value = list
		|> filter [
			element = element
				|> === value
		]
		|> len
];
contains = [
	real(2) { min, max }, real v = min <= v && v <= max
];
within = flip(contains);
diff = [
	real(2) pair = pair(0)
		|> - pair(1)
];
ratio = [
	real(2) pair = pair(0)
		|> / pair(1)
];
findAllIn = [
	any value, any() list = list
		|> indices
		|> filter [list(i) === value]
];
findAllSeqIn = [
	any() seq, any() list = seq(0)
		|> findAllIn list
		|> filter [i <= len(list) - len(seq)]
		|> filter [list(i:i + len(seq)) === seq]
];
maybeFirst = [
	any() list = list
		|> len
		|> ? [= list(0)] [= no]
];
maybe = [
	void value, operator fn = value
] & [
	value, operator fn = fn(value)
];
findIn = [
	any value, any() list = value
		|> findAllIn list
		|> maybeFirst
];
findSeqIn = [
	any() seq, any() list = seq
		|> findAllSeqIn list
		|> maybeFirst
];
ln = log;
log = log10;
DEGREES_TO_RADIANS = PI / 180;
degrees = [
	real radians = radians / DEGREES_TO_RADIANS
];
radians = [
	real degrees = degrees * DEGREES_TO_RADIANS
];
both = [
	value, operator op = { value, op(value) }
];
reciprocal = /;
complement = [
	real p = 1 - p
];
logBase = [
	real base, real x = x
		|> ln
		|> / ln(base)
];
clamp = [
	real n, real a, real b = n
		|> max a
		|> min b
];
randInt = [
	real min, real max = max
		|> - min
		|> + 1
		|> * random()
		|> + min
		|> floor
];
axis = [
	real() vector, real n = vector(n)
];
sliceOf = [
	real(2) n, any() list = list(n(0):n(1))
] & [
	real(1) n, any() list = list(n(0):)
] & [
	real n, any() list = list(n:)
];
listOf = [
	value = { value }
];
head = [
	any() list, real count = list(:count)
] & [
	any() list = list(:-1)
];
tail = [
	any() list, real count = list(len(list) - count:)
] & [
	any() list = list(1:)
];
first = [
	any() list = list(0)
];
last = [
	any() list = list(len(list) - 1)
];
lerp = [
	real t, real a, real b = t
		|> both complement
		|> * { b, a }
		|> sum
];
sum = [
	real() list = list
		|> reduce 0 +
];
product = [
	real() list = list
		|> reduce 1 *
];
mean = [
	real() list = list
		|> sum
		|> / len(list)
];
freqMean = [
	real() list, real() freq = list
		|> * freq
		|> sum
];
percentile = [
	real() list, real x = list
		|> filter [real v = v |> < x]
		|> len
		|> + 0.5
		|> / len(list)
];
sumSquared = [
	real() list = list
		|> pow 2
		|> sum
];
variance = [
	real() list = list
		|> - mean(list)
		|> sumSquared
		|> / len(list)
];
stdDev = [
	real() list = list
		|> variance
		|> sqrt
];
sampStdDev = [
	real() list = list
		|> sampVariance
		|> sqrt
];
sampVariance = [
	real() list = list
		|> - mean(list)
		|> sumSquared
		|> / $(len(list) - 1)
];
freqStdDev = [
	real() list, real() freq = list
		|> - freqMean(list, freq)
		|> pow 2
		|> * freq
		|> sum
		|> sqrt
];
stdDevSum = [
	real() stdDevs = stdDevs
		|> sumSquared
		|> sqrt
];
stdDevPHat = [
	real p, real n = p
		|> complement
		|> * p
		|> / n
		|> sqrt
];
stdDev2PHat = [
	real(2) ps, real(2) ns = ps
		|> stdDevPHat ns
		|> stdDevSum
];
stdDevXBar = [
	real sigma, real n = sigma
		|> / sqrt(n)
];
stdDev2XBar = [
	real(2) sigmas, real(2) ns = sigmas
		|> stdDevXBar ns
		|> stdDevSum
];
stdDevB = [
	real(2)() points = points
		|> stdDevResiduals linReg(points)
		|> is se
		|> to points
		|> zip
		|> first
		|> is x
		|> - mean(x)
		|> sumSquared
		|> sqrt
		|> / se
		|> reciprocal
];
zCrit = [
	real C = C
		|> complement
		|> / 2
		|> invNorm 0 1
		|> * -1
];
df = [
	real n = n
		|> - 1
];
effectiveDf = [
	real() devs, real() ns = devs
		|> pow 4
		|> / df(ns)
		|> sum
		|> is denom
		|> to devs
		|> stdDevSum
		|> pow 4
		|> / denom
];
tCrit = [
	real C, real n = C
		|> complement
		|> / 2
		|> invT df(n)
		|> * -1
];
slopeTCrit = [
	real C, real n = C
		|> complement
		|> / 2
		|> invT slopeDf(n)
		|> * -1 
];
multiTCrit = [
	real C, real() devs, real() ns = C
		|> complement
		|> / 2
		|> invT effectiveDf(devs, ns)
		|> * -1
];
slope = [
	operator line = { 1, 0 }
		|> line
		|> diff
];
1PropZInt = [
	real pHat, real n, real C = pHat
		|> stdDevPHat n
		|> * zCrit(C)
		|> * { -1, 1 }
		|> + pHat
];
2PropZInt = [
	real(2) pHats, real(2) ns, real C = pHats
		|> stdDev2PHat ns
		|> * zCrit(C)
		|> * { -1, 1 }
		|> + diff(pHats)
];
1MeanZInt = [
	real xBar, real sigma, real n, real C = sigma
		|> stdDevXBar n
		|> * zCrit(C)
		|> * { -1, 1 }
		|> + xBar
];
1MeanTInt = [
	real xBar, real sigma, real n, real C = sigma
		|> stdDevXBar n
		|> * tCrit(C, n)
		|> * { -1, 1 }
		|> + xBar
];
2MeanZInt = [
	real(2) xBars, real(2) sigmas, real(2) ns, real C = sigmas
		|> stdDev2XBar ns
		|> * zCrit(C)
		|> * { -1, 1 }
		|> + diff(xBars)
];
2MeanTInt = [
	real(2) xBars, real(2) sigmas, real(2) ns, real C = sigmas
		|> stdDev2XBar ns
		|> * multiTCrit(C, sigmas, ns)
		|> * { -1, 1 }
		|> + diff(xBars)
];
matchedZInt = [
	real(2)() data, real sigma, real C = data(0)
		|> - data(1)
		|> is xDiff
		|> mean
		|> 1MeanZInt sampStdDev(xDiff) len(xDiff) C
];
matchedTInt = [
	real(2)() data, real C = data(0)
		|> - data(1)
		|> is xDiff
		|> mean
		|> 1MeanTInt sampStdDev(xDiff) len(xDiff) C
];
slopeZInt = [
	real b, real sd, real C = sd
		|> * zCrit(C)
		|> * { -1, 1 }
		|> + b
];
slopeTInt = [
	real b, real sb, real n, real C = sb
		|> * slopeTCrit(C, n)
		|> * { -1, 1 }
		|> + b
];
MoE = [
	real(2) interval = interval(1)
		|> - interval(0)
		|> / 2
];
1PropZ = [
	real pHat, real n, real p0 = pHat
		|> standardize p0 stdDevPHat(p0, n)
];
1PropZTest = [
	real pHat, real n, real p0, real sides = pHat
		|> 1PropZ n p0
		|> abs
		|> normalcdf 1e99 0 1
		|> * sides
];
1MeanZ = [
	real xBar, real sigma, real n, real mu0 = xBar
		|> standardize mu0 stdDevXBar(sigma, n)
];
1MeanZTest = [
	real xBar, real sigma, real n, real mu0, real sides = xBar
		|> 1MeanZ sigma n mu0
		|> abs
		|> normalcdf 1e99 0 1
		|> * sides
];
1MeanTTest = [
	real xBar, real sigma, real n, real mu0, real sides = xBar
		|> 1MeanZ sigma n mu0
		|> abs
		|> Tcdf 1e99 df(n)
		|> * sides
];
pHatC = [
	real(2) pHats, real(2) ns = pHats
		|> * ns
		|> sum
		|> / sum(ns)
];
2PropZ = [
	real(2) pHats, real(2) ns, real nullDiff = pHats
		|> pHatC ns
		|> is pC
		|> to pHats(0)
		|> - pHats(1)
		|> standardize nullDiff stdDev2PHat({ pC, pC }, ns)
];
2PropZTest = [
	real(2) pHats, real(2) ns, real nullDiff, real sides = pHats
		|> 2PropZ ns nullDiff
		|> abs
		|> normalcdf 1e99 0 1
		|> * sides
];
2MeanZ = [
	real(2) xBars, real(2) sigmas, real(2) ns, real nullDiff = xBars
		|> diff
		|> standardize nullDiff stdDev2XBar(sigmas, ns)
];
2MeanZTest = [
	real(2) xBars, real(2) sigmas, real(2) ns, real nullDiff, real sides = xBars
		|> 2MeanZ sigmas ns nullDiff
		|> abs
		|> normalcdf 1e99 0 1
		|> * sides
];
2MeanTTest = [
	real(2) xBars, real(2) sigmas, real(2) ns, real nullDiff, real sides = xBars
		|> 2MeanZ sigmas ns nullDiff
		|> abs
		|> Tcdf 1e99 effectiveDf(sigmas, ns)
		|> * sides
];
matchedZTest = [
	real(2)() data, real sigma, real nullDiff, real sides = data(0)
		|> - data(1)
		|> is xDiff
		|> mean
		|> 1MeanZTest sigma len(xDiff) nullDiff sides
];
matchedTTest = [
	real(2)() data, real nullDiff, real sides = data(0)
		|> - data(1)
		|> is xDiff
		|> mean
		|> 1MeanTTest sampStdDev(xDiff) len(xDiff) nullDiff sides
];
slopeZTest = [
	real b, real sd, real beta, real sides = b
		|> standardize beta sd
		|> abs
		|> normalcdf 1e99 0 1
		|> * sides
];
slopeZTest = [
	real b, real sd, real beta, real sides = b
		|> standardize beta sd
		|> abs
		|> normalcdf 1e99 0 1
		|> * sides
];
slopeDf = [
	real n = n
		|> - 2
];
slopeTTest = [
	real b, real sb, real n, real beta, real sides = b
		|> standardize beta sb
		|> abs
		|> Tcdf 1e99 slopeDf(n)
		|> * sides
];
Fdf = [
	real n, real k = { k, n - (k + 1) }
];
// SSRegr: df = k
// SSResid: df = n - (k + 1)
// F = ((r^2) / k) / ((1 - r^2) / (n - (k + 1)))
F = [
	real rSquared, real n, real k = rSquared
		|> both complement
		|> / Fdf(n, k)
		|> ratio
];
FTest = [
	real rSquared, real n, real k = n
		|> Fdf k
		|> is df
		|> to rSquared
		|> F n k
		|> Fcdf 1e99 df(0) df(1) 
];
FcdfIndefinite = [
	// old approximation from https://www.scirp.org/journal/paperinformation.aspx?paperid=82593
	// approximation from http://jaguar.fcav.unesp.br/RME/fasciculos/v29/v29_n2/Daniel.pdf
	real x, real u, real v = u
		|> > v
		|> ? [= x
			|> reciprocal
			|> FcdfIndefinite v u
		] [= x
			|> * u
			|> / 3
			|> is t0
			|> to v
			|> * 2
			|> is t1
			|> to 2
			|> / 9
			|> / u
			|> is t2
			|> to t1
			|> + t0
			|> + u
			|> - 2
			|> * x
			|> / $(t1 + 4 * t0)
			|> pow $(1 / 3)
			|> - complement(t2)
			|> / sqrt(t2)
			|> normalcdfIndefinite
		]
];
Fcdf = [
	real lower, real upper, real u, real v = { upper, lower }
		|> FcdfIndefinite u v
		|> diff
];
X2Contribution = [
	real expected, real observed = observed
		|> - expected
		|> pow 2
		|> / expected
];
X2 = [
	real() expected, real() observed = expected
		|> X2Contribution observed
		|> sum
];
X2GOFTest = [ // one variable
	real() expected, real() observed = expected
		|> X2 observed
		|> X2cdf 1e99 df(len(observed))
];
grandMean = [
	real() means, real() ns = means
		|> * ns
		|> sum
		|> / sum(ns)
];
SSTreatments = [
	real() means, real() ns = means
		|> grandMean ns
		|> - means
		|> pow 2
		|> * ns
		|> sum
];
SSError = [
	real() stdDevs, real() ns = ns
		|> - 1
		|> * pow(stdDevs, 2)
		|> sum
];
ANOVADf = [
	real() ns = ns
		|> sum
		|> is N
		|> to ns
		|> len
		|> [real k = { k - 1, N - k }]
];
ANOVAF = [
	real() means, real() stdDevs, real() ns = means
		|> SSTreatments ns
		|> / SSError(stdDevs, ns)
		|> / ratio(ANOVADf(ns))
];
ANOVA = [
	real() means, real() stdDevs, real() ns = ns
		|> ANOVADf
		|> is df
		|> to means
		|> ANOVAF stdDevs ns
		|> Fcdf 1e99 df(0) df(1)
];
ANOVATable = [
	real() means, real() stdDevs, real() ns = ns
		|> ANOVADf
		|> is df
		|> to { SSTreatments(means, ns), SSError(stdDevs, ns) }
		|> is SS
		|> to {
			{ df(0), SS(0), SS(0) / df(0), ANOVAF(means, stdDevs, ns), ANOVA(means, stdDevs, ns) },
			{ df(1), SS(1), SS(1) / df(1), 0, 0 }
		}
];
matrixMean = [
	real()() table = table
		|> mean
		|> mean
];
matrixEntries = [
	real()() table = table
		|> apply { rows, columns }
		|> product
];
estimatedRowEffect = [
	real()() table, real index = table(index)
		|> mean
		|> - matrixMean(table)
];
estimatedColumnEffect = [
	real()() table, real index = table
		|> transpose
		|> estimatedRowEffect index
];
ANOVA2Residual = [
	real()() table, real row, real column = table
		|> matrixMean
		|> + estimatedRowEffect(table, row)
		|> + estimatedColumnEffect(table, column)
		|> * -1
		|> + table(row)(column)
];

ANOVA2RowDf = [
	real()() table = table
		|> rows
		|> - 1
];

ANOVA2ColumnDf = [
	real()() table = table
		|> columns
		|> - 1
];

ANOVA2ErrorDf = [
	real()() table = table
		|> apply { ANOVA2RowDf, ANOVA2ColumnDf }
		|> product
];

// { row df, column df, error df }
ANOVA2Df = [
	real()() table = table
		|> apply { ANOVA2RowDf, ANOVA2ColumnDf, ANOVA2ErrorDf }
];

SSError2 = [
	real()() table = table
		|> indicesOf
		|> [
			real(2) inx = table
				|> ANOVA2Residual inx(0) inx(1)
		]
		|> pow 2
		|> flat 1
		|> sum
];

SSRow = [
	real()() table = table
		|> estimatedRowEffect rangeTo(rows(table))
		|> pow 2
		|> * columns(table)
		|> sum
];

SSColumn = [
	real()() table = table
		|> transpose
		|> SSRow
];

ANOVA2RowF = [
	real()() table = table
		|> SSRow
		|> / SSError2(table)
		|> / ANOVA2RowDf(table)
		|> * ANOVA2ErrorDf(table)
];

ANOVA2ColumnF = [
	real()() table = table
		|> transpose
		|> ANOVA2RowF
];

ANOVA2Row = [
	real()() table = table
		|> ANOVA2RowF
		|> Fcdf 1e99 ANOVA2RowDf(table) ANOVA2ErrorDf(table)
];

ANOVA2Column = [
	real()() table = table
		|> transpose
		|> ANOVA2Row
];

// { row p-value, column p-value }
ANOVA2 = [
	real()() table = table
		|> apply { ANOVA2Row, ANOVA2Column }
];

ANOVA2Table = [
	real()() table = table
		|> ANOVA2Df
		|> is df
		|> to table
		|> apply { SSRow, SSColumn, SSError2 }
		|> is SS
		|> / df
		|> is MS
		|> to table
		|> apply { ANOVA2RowF, ANOVA2ColumnF }
		|> is F
		|> to table
		|> apply { ANOVA2Row, ANOVA2Column }
		|> is p
		|> to {
			{ df(0), SS(0), MS(0), F(0), p(0) },
			{ df(1), SS(1), MS(1), F(1), p(1) },
			{ df(2), SS(2), MS(2), 0, 0 }
		}
];

// vectors
reflect = [
	real() v, real() n = v
		|> projectOnto n
		|> * 2
		|> * -1
		|> + v
];

rightNormal = [
	real(2) { x, y } = { -y, x }
];

leftNormal = [
	real(2) vec = vec
		|> rightNormal
		|> * -1	
];

dot = [
	real() u, real() v = u
		|> * v
		|> sum
];

projectOnto = [
	real() u, real() v = u
		|> dot v
		|> / sumSquared(v)
		|> * v
];

cross = [
	real(3) u, real(3) v = {
		u(1) * v(2) - u(2) * v(1),
		u(2) * v(0) - u(0) * v(2),
		u(0) * v(1) - u(1) * v(0)
	}
] & [
	real(2) u, real(2) v = u(0) * v(1) - u(1) * v(0)
];

planeNormal = [
	real() a, real() b, real() c = cross(a - b, c - b)
];

mag = [
	real() v = v
		|> sumSquared
		|> sqrt
];

distance = [
	real() a, real() b = a
		|> - b
		|> mag
];

normalize = [
	real() v = v
		|> / mag(v)
];

normalDot = [
	real() u, real() v = u
		|> dot v
		|> / mag(u)
		|> / mag(v)
];

angleBetween = [
	real() u, real() v = u
		|> normalDot v
		|> acos
];

// matrices
isMatrix =	[real()() mat = false] &
			[rest = false];
isVector =	[real()() mat = false] &
			[real() vec = true] &
			[rest = false];
identityMatrix = [
	real dim = dim
		|> rangeTo
		|> is indices
		|> [
			real row = row
				|> == indices
		]
];
permutationMatrix = [
	real() order = order
		|> len
		|> identityMatrix
		|> indicesOf
		|> [
			real(2) inx = inx(1)
				|> == order(inx(0))
		]
];
rows = [
	real()() matrix = matrix
		|> len
];
columns = [
	real()() matrix = matrix(0)
		|> len
];
mul = [
	real()() m0, real()() m1 = m0
		|> [
			real() row = m1
				|> transpose
				|> * row
				|> sum
		]
];
matrixPow = [
	real()() m, real p = p
		|> - 1
		|> rangeTo
		|> fill [= m]
		|> reduce m mul
];
transform = [
	real()() m, real() v = m
		|> * v
		|> sum
];
transformBy = [
	real() v, real()() m = m
		|> transform v
];
minor = [
	real()() m, real i, real j = m
		|> rows
		|> rangeTo
		|> filter [real r = r |> != i]
		|> [
			real r = m
				|> columns
				|> rangeTo
				|> filter [real c = c |> != j]
				|> [real c = m(r)(c)]
		]
];
determinant = [
	real()() m = m
		|> columns
		|> is cols
		|> == rows(m)
		|> ? [= cols
			|> == 1
			|> ? [= m(0)(0)] [= cols
				|> == 2
				|> ? [= m(0)(0) * m(1)(1) - m(1)(0) * m(0)(1)] [= cols
					|> rangeTo
					|> [
						real i = m
							|> minor 0 i
							|> determinant
							|> * m(0)(i)
							|> * pow(-1, i)
					]
					|> sum
				]
			]
		] [= 0]		
];
baseIndicesOf = [
	structure, real() priorIndices = structure
		|> indices
		|> [
			real inx = priorIndices
				|> concat { inx }
		]
		|> is indices
		|> to structure(0)
		|> in primitive
		|> ? [= indices] [= indices
			|> map [
				inxs = inxs
					|> last
					|> nthOf structure
					|> baseIndicesOf inxs
			]
		]
];
indicesOf = [
	structure = structure
		|> baseIndicesOf {}
];
indexMatrix = [
	real rows, real columns = rows
		|> rangeTo
		|> [
			real i = columns
				|> rangeTo
				|> [real j = { i, j }]
		]
];
cofactors = [
	real()() m = m
		|> rows
		|> rangeTo
		|> [
			real i = m
				|> columns
				|> rangeTo
				|> [
					real j = m
						|> minor i j
						|> determinant
						|> * pow(-1, i + j)
				]
		]
];
adjugate = [
	real()() m = m
		|> cofactors
		|> transpose
];
transpose = [
	real()() m = m
		|> zip
];
inverse = [
	real()() m = m
		|> adjugate
		|> / determinant(m)
];
outerProduct = [
	real() u, real() v = u
		|> [
			real ui = ui
				|> * v
		]
];
swapRows = [
	real()() mat, real i, real j = mat
		|> swap i j
];
addRowMultiple = [
	real()() mat, real dst, real src, real factor = mat
		|> indices
		|> [
			real index = index
				|> == dst
				|> ? [= mat(index)
					|> + $(mat(src) * factor)
				] [= mat(index)]
		]
];
multiplyRow = [
	real()() mat, real i, real factor = mat
		|> addRowMultiple i i $(factor - 1)
];
_echelonColumn = [
	real()() mat, real c, real r = c
		|> nthOf transpose(mat(r:))
		|> argMax
		|> is targetIndex
		|> nthOf mat
		|> is target
		|> to mat
		|> indices
		|> [
			real index = index
				|> == targetIndex
				|> ? [= mat(index)] [= mat(index)
					|> is row
					|> to row(c)
					|> / target(c)
					|> * target
					|> * -1
					|> + row
				]
		]
		|> swapRows r targetIndex
];
echelon = [
	real()() mat = mat
		|> _echelonColumn 0 0
];
reducedEchelon = [
	real()() mat = mat
		|> echelon
];
PRINT_MATRIX_DIGITS = 2;

X2MatrixDf = [
	real()() samples = samples
		|> apply { rows, columns } 
		|> - 1
		|> product
];
X2MatrixExpected = [
	real()() samples = samples
		|> sum
		|> is rowTotals
		|> / sum(rowTotals)
		|> outerProduct sum(transpose(samples)) // column totals	
];
X2Matrix = [
	real()() samples = samples
		|> X2MatrixExpected
		|> flat 1
		|> X2 flat(samples, 1)
];
X2MatrixTest = [
	real()() samples = samples
		|> X2Matrix
		|> X2cdf 1e99 X2MatrixDf(samples)
];

left = [
	any() list = list
		|> len
		|> / 2
		|> floor
		|> [real index = list(:index)]
];
right = [
	any() list = list
		|> len
		|> odd
		|> * 2
		|> + len(list)
		|> / 2
		|> floor
		|> [real index = list(index:)]
];
middle = [
	real() list = list
		|> len
		|> odd
		|> ? [= len(list) // odd
			|> / 2
			|> floor
			|> nthOf list
		] [= len(list) // even
			|> / 2
			|> - { 0, 1 }
			|> nthOf list
			|> mean
		]
];
median = [
	real() list = list
		|> sort
		|> middle
];
Q1 = [
	real() list = list
		|> sort
		|> left
		|> middle
];
Q3 = [
	real() list = list
		|> sort
		|> right
		|> middle
];
IQR = [
    real() list = Q3(list)
        |> - Q1(list)
];
minAll = [
	real() list = list
		|> reduce Infinity min
];
maxAll = [
	real() list = list
		|> reduce -(Infinity) max
];
bounds = [
	real() list = list
		|> apply { minAll, maxAll }
];
argMin = [
	real() list = list
		|> minAll
		|> findIn list
];
argMax = [
	real() list = list
		|> maxAll
		|> findIn list
];
range = [
	real() list = list
		|> maxAll
		|> - minAll(list)
];
apply = [
	arg, operator fn = arg
		|> fn
];
call = [
	any() args, operator op = args
		|> map wrap
		|> unwrapCall op
];
on = [
	operator op, any() args = args
		|> call op
];
unwrapOn = [
	operator op, operator() args = args
		|> unwrapCall op
];
wrap = [
	value = [= value]
];
unwrap = [
	operator wrapped = wrapped()
];
IQROutliers = [
	real() list = list
		|> apply { Q1, IQR, Q3 }
		|> is Q
		|> to list
		|> filter [
			real x = { x, clamp(x, Q(0), Q(2)) }
				|> diff
				|> abs
				|> > $(Q(1) * 1.5)
		]
];
stdDevOutliers = [
	real() data = data
		|> stdDev
		|> is sd
		|> to data
		|> mean
		|> is mu
		|> to data
		|> standardize mu sd
		|> filter [
			real z = z
				|> abs
				|> <= 2
		]
		|> destandardize mu sd
];
summarize = [
	real() list = { minAll, Q1, median, Q3, maxAll }
		|> [operator stat = list |> stat]
];
linRegCoefs = [
	real()() points = points(0)
		|> len
		|> is k
		|> to points
		|> [
			real() point = concat({ 1 }, head(point))
		]
		|> is X
		|> to points
		|> axis -1
		|> is y
		|> to X
		|> transpose
		|> mul X
		|> inverse
		|> mul transpose(X)
		|> transform y
];
residual = [
	real() point, operator model = point
		|> head $(len(point) - 1)
		|> call model
		|> * -1
		|> + last(point)
];
stdDevResiduals = [
	real(2)() points, operator model = points
		|> residual model
		|> sumSquared
		|> / $(len(points) - 2)
		|> sqrt
];
yCoord = [
	real()() points = points
		|> zip
		|> last
];
SSTotal = [
	real()() points = points
		|> yCoord
		|> is y
		|> - mean(y)
		|> sumSquared
];
SSResid = [
	real()() points, operator model = points
		|> residual model
		|> sumSquared
];
SSRegression = [
	real()() points, operator model = points
		|> SSTotal
		|> - SSResid(points, model)
];
rSquared = [
	real()() points, operator model = points
		|> SSResid model
		|> / SSTotal(points)
		|> complement
];
rSquaredAdj = [
	real()() points, operator model = points
		|> SSResid model
		|> / SSTotal(points)
		|> * $(len(points) - 1)
		|> / $(len(points) - (len(points(0)) + 1))
		|> complement
];
residualPlot = [
	real(2)() points, operator model = points
		|> [real(2) point = { point(0), residual(point, model) }]
		|> scatterPlot
];

// logistic regression
probToOdds = [
	real p = p
		|> both complement
		|> ratio
];
oddsToProb = [
	real odds = odds
	|> / $(1 + odds)
];
logit = [
	real p = p
		|> probToOdds
		|> ln
];
unlogit = [
	real p = p
		|> exp
		|> oddsToProb
];
logitReg = [
	real(2)() points = points
		|> [real(2) point = { point(0), logit(point(1)) }]
		|> linReg
		|> [
			operator m = [
				real x = x
					|> m
					|> unlogit
			]
		]
];
subRange = [
	real sub, real span = span
		|> * sub
		|> round
		|> rangeTo
		|> / sub
];
subdivide = [
	real(2) { min, max }, real count = count
		|> rangeTo
		|> / $(count - 1)
		|> lerp min max
];
integral = [
	operator fn, real a, real b, real dx: 0.01 = { a, b }
		|> + $(dx * 0.5) // MRAM
		|> subdivide ceil(1 / dx)
		|> fn
		|> * dx
		|> sum
];
standardize = [
	real x, real mu, real sd = x
		|> - mu
		|> / sd
];
toZ = [
	real() x = x
		|> standardize mean(x) stdDev(x)
];
toT = [
	real() x = x
		|> standardize mean(x) sampStdDev(x)
];
destandardize = [
	real z, real mu, real sd = z
		|> * sd
		|> + mu
];
normalpdf = [
	real x, real mu, real sd = x
		|> standardize mu sd
		|> is z
		|> to E
		|> pow $(-0.5 * pow(z, 2))
		|> / sqrt(2 * PI)
];
normalcdfIndefinite = [
	real z = z
		// approximation from [http://m-hikari.com/ams/ams-2014/ams-85-88-2014/epureAMS85-88-2014.pdf]
		|> pow 2
		|> * 0.0735
		|> is s
		|> + $(4 / PI)
		|> / $(s + 1)
		|> * pow(z, 2)
		|> * -0.5
		|> exp
		|> complement
		|> sqrt
		|> * sign(z)
		|> * 0.5
		|> + 0.5
];
normalcdf = [
	real lower, real upper, real mu, real sd = { upper, lower }
		|> standardize mu sd
		|> normalcdfIndefinite
		|> diff
];
invNorm = [
	real area, real mu, real sd = area
		// approximation from [http://m-hikari.com/ams/ams-2014/ams-85-88-2014/epureAMS85-88-2014.pdf]
		|> * 2
		|> - 1
		|> pow 2
		|> complement
		|> ln
		|> * 2
		|> is s
		|> * 0.0735
		|> + $(4 / PI)
		|> is s2
		|> to s
		|> * -0.294
		|> + pow(s2, 2)
		|> sqrt
		|> - s2
		|> / 0.147
		|> sqrt
		|> * sign(area - 0.5)
		|> destandardize mu sd
];
TcdfIndefinite = [
	real x, real df = df
		// approximation from [https://www.statperson.com/Journal/StatisticsAndMathematics/Article/Volume8Issue1/IJSAM_8_1_4.pdf]	
		|> switch {
			case(1, [= x
				|> atan
				|> / PI
				|> + 0.5
			])
			case(2, [= x
				|> pow 2
				|> + 2
				|> sqrt
				|> reciprocal
				|> * 0.5
				|> * x
				|> + 0.5
			])
			default([= x
				|> pow 2
				|> * 2
				|> + $(4 * df)
				|> is denom
				|> to x
				|> pow 2
				|> - 1
				|> + $(4 * df)
				|> / denom
				|> * x
				|> normalcdfIndefinite
			])
		}
];
Tcdf = [
	real lower, real upper, real df = { upper, lower }
		|> TcdfIndefinite df
		|> diff
];
binarySearch = [
	real(2) range, real thresh, operator fn, real goal = range
		|> mean
		|> is mid
		|> fn
		|> is out
		|> - goal
		|> abs
		|> < thresh
		|> ? [= mid] [= out
			|> < goal
			|> ? [= { mid, range(1) }] [= { range(0), mid }]
			|> binarySearch thresh fn goal
		]
];
INVT_RANGE = 50 |> * { -1, 1 };
INVT_PRECISION = 0.0002;
invT = [
	real area, real df = area
		// approximation from [https://www.statperson.com/Journal/StatisticsAndMathematics/Article/Volume8Issue1/IJSAM_8_1_4.pdf]
		|> within { 0, 1 }
		|> ? [= df
			|> switch {
				case(1, [= area
					|> - 0.5
					|> * PI
					|> tan
				])
				case(2, [= area
					|> * 2
					|> - 1
					|> pow 2
					|> is term
					|> * 2
					|> / complement(term)
					|> sqrt
					|> * sign(area - 0.5)
				])
				default([= INVT_RANGE
					|> binarySearch INVT_PRECISION [real x = TcdfIndefinite(x, df)] area
				])
			}
		] [= NaN]
];
GAMMA_DX = 0.05;
GAMMA_MAX_X = 60;
gamma = [
	real z = z
		|> - 1
		|> is zm1
		|> to [
			real x = x
				|> pow zm1
				|> * exp(-x)
		]
		|> integral 0 GAMMA_MAX_X GAMMA_DX
];
upperGamma = [
	real s, real x = s
		|> - 1
		|> is sm1
		|> to [
			real t = t
				|> pow sm1
				|> * exp(-t)
		]
		|> integral min(x, GAMMA_MAX_X) GAMMA_MAX_X GAMMA_DX
];
lowerGamma = [
	real s, real x = s
		|> - 1
		|> is sm1
		|> to [
			real t = t
				|> pow sm1
				|> * exp(-t)
		]
		|> integral 0 min(x, GAMMA_MAX_X) GAMMA_DX
];
regularizedGamma = [
	real s, real x = s
		|> lowerGamma x
		|> / gamma(s)
];
X2cdf = [
	real lower, real upper, real df = df
		|> / 2
		|> regularizedGamma $({ upper, lower } / 2) 
		|> diff
];
geometpdf = [
	real x, real p = p
		|> complement
		|> pow $(x - 1)
		|> * p
];
geometcdf = [
	real x, real p = x
		|> + 1
		|> rangeTo
		|> geometpdf p
		|> sum
];
factorial = [
	real x = x
		|> <= 1
		|> ? [=1] [= rangeTo(x)
			|> + 1
			|> product
		]
];
nCr = [
	real n, real r = n
		|> - r
		|> rangeTo
		|> + r
		|> + 1
		|> product
		|> / factorial(n - r)
];
binompdf = [
	real x, real p, real trials = p
		|> complement
		|> pow $(trials - x)
		|> * pow(p, x)
		|> * nCr(trials, x)
];
binomcdf = [
	real x, real p, real trials = x
		|> + 1
		|> rangeTo
		|> binompdf p trials
		|> sum
];
for = [
	start, operator continue, operator inc, operator body = start
		|> continue
		|> ? [= start
			|> effect body
			|> inc
			|> for continue inc body
		] [= no]
];

// differential equations
diffAdvance = [
	operator() ddt, real dt = [
		real() p = ddt
			|> indices
			|> [real i = p(i + 1) + ddt(i)(p) * dt]
			|> prepend $(p(0) + dt)
	]
];
diffSolve = [
	real() initialValue, operator() ddt, real finalT, real dt: 0.01 = initialValue
		|> (diffAdvance(dydt, dt) ^ (finalT / dt))
];

// switch
condition = [
	operator check, operator expr = { check, expr } 
];
case = [
	check, operator expr = { [value = check |> === value], expr }
];
default = [
	operator expr = { [value = true], expr }
];
switch = [
	value, operator(2)() caseExprs = caseExprs
		|> filter [
			operator(2) case = case(0)(value)
		]
		|> [
			operator(2)() case = case(0)(1)()
		]
];

// strings
String = real();
# = [String a, String b = concat(a, b)];

assert = [
	value, operator check, reference, String reason = value
		|> check reference
		|> assert reason
		|> to value
] & [
	real condition, String reason = condition
		|> ? [= no] [= error("Assertion failed: " # reason)]
];
toUpperCase = [
	real ch = ch
		|> within "az"
		|> ? [= ch - 32] [= ch]
];
toLowerCase = [
	real ch = ch
		|> within "AZ"
		|> ? [= ch + 32] [= ch]
];
capitalize = [
	String str = { str(0) }
		|> toUpperCase
		|> concat str(1:)
];
split = [
	String str, String delim = delim
		|> findSeqIn str
		|> is index
		|> == -1
		|> ? [= { str }] [= { str(:index) }
			|> concat split(str(index + len(delim):), delim)
		]
];
join = [
	String() strings, String delim: "" = strings
		|> reduce "" [
			String acc, String element = acc
				|> len
				|> ? [= (acc # delim # element)] [= element]
		]
];
replaceAll = [
	String str, String find, String replace = str
		|> split find
		|> join replace
];
replace = [
	String str, String find, String replace = find
		|> findSeqIn str
		|> is index
		|> == -1
		|> ? [= str] [= str(:index) # replace # str(index + len(find):)]
];

// objects
Field = operator(2);
Object = Field();
field = [
	String name, value = { [= name], [struct = value] }
];
method = [
	String name, operator fn = { [= name], fn }
];
_getObjectEntries = [
	Object struct, String name = struct
		|> filter [
			Field entry = entry(0)()
				|> === name
		]
];
read = [
	any struct, String name = struct
		|> decay
		|> _getObjectEntries name
		|> maybeFirst
		|> maybe [Field entry = entry(1)(struct)]
];
has = [
	Object struct, String name = struct
		|> _getObjectEntries name
		|> empty
		|> !
];
with = [
	Object struct, String name, value = struct
		|> has name
		|> ? [= struct
			|> filter [
				Field entry = entry(0)()
					|> !== name
			]
		] [= struct]
		|> append field(name, value)
];
keys = [
	Object struct = struct
		|> [Field entry = entry(0)()]
];
values = [
	Object struct = struct
		|> [
			Field entry = entry(1)(struct)
				|> wrap
		]
];

// hash table
Entry = [
	any key, any value = { [= key], [= value] }
];

hash = [
	any key = key
		|> in real
		|> ? [= key
			|> + 29837162.12376
			|> * 394872.12398
			|> % 198.53985612
			|> * 918273186.318263
			|> % 9873.13229874
			|> * 2913782
			|> abs
			|> round
		] [= key
			|> indices
			|> [real index = hash(key(index))]
			|> sum
			|> hash
		]
];

HashTable = [
	operator(2)() pairs = pairs
		|> len
		|> * 1.25
		|> ceil
		|> is tableSize
		|> to pairs
		|> [
			operator(2) pair = pair(0)()
				|> hash
				|> % tableSize
				|> [
					real index = { [= index] }
						|> concat pair
				]
		]
		|> is indexedPairs
		|> to tableSize
		|> rangeTo
		|> [
			real index = indexedPairs
				|> filter [operator(3) pair = pair(0)() |> == index]
				|> is pairs
				|> len
				|> ? [= pairs
					|> [operator(3) pair = pair(1:)]
					|> [operator(2)() pairs = [= pairs]]
				] [= [= { }]]
		]
		|> is hashTable
];

_getEntries = [
	operator() table, any key = key
		|> hash
		|> % len(table)
		|> nthOf table
		|> [entries = entries()]
		|> filter [operator(2) pair = pair(0)() |> === key]
];

hasKey = [
	operator() table, any key = table
		|> _getEntries key
		|> len
		|> > 0 
];

getValue = [
	operator() table, any key = table
		|> _getEntries key
		|> is matches
		|> len
		|> ? [= matches(0)(1)()] [= no]
];

// classes
createClass = [
	Object spec, String name = 
		getFields = [
			type goal = spec
				|> filter [
					Field entry = spec
						|> read entry(0)()
						|> in goal
				]
		];
		template = getFields(type);
		methods = getFields(operator);
		fields = keys(template);
		classType = createBaseType(name);
		template
			|> values
			|> unwrap
			|> createOperator [
				operator() args = args
					|> indices
					|> map [
						real index = fields(index)
							|> field args(index)()
					]
					|> concat methods
					|> as classType
			]
			|> is construct
			|> withOverload [
				Object struct = fields
					|> [
						String name = struct
							|> read name
							|> assert !== no $("Field '" # name # "' is missing")
							|> wrap
					]
					|> unwrapCall construct
			]
			|> withOverload [= classType];
];
class = unwrap;
extends = [
	Object base, Object template = base
		|> concat template
];

// complex
class Complex = {
	r: real
	i: real
};
Complex_t = class(Complex);
toMatrix &= [
	Complex_t { r:, i: } = {
		{ r, -i },
		{ i, r }
	}
];
Re = [Complex_t z = z.r];
Im = [Complex_t z = z.i];
+ &= [
	Complex_t a, Complex_t b = Complex(a.r + b.r, a.i + b.i)
];
+ &= commute([
	Complex_t a, real b = Complex(a.r + b, a.i)
]);
- &= [
	Complex_t z = Complex(-z.r, -z.i)
];
specifyComplex = [
	operator op = op
		|> specify {
			{ Complex_t, Complex_t },
			{ Complex_t, real },
			{ real, Complex_t }
		}
		|> asOverloads
];
- &= specifyComplex([
	a, b = b
		|> -
		|> + a
]);
* &= [
	Complex_t a, Complex_t b = Complex(
		a.r * b.r - a.i * b.i,
		a.i * b.r + a.r * b.i
	)
];
* &= commute([
	Complex_t a, real b = Complex(a.r * b, a.i * b)
]);
/ &= specifyComplex([
	a, b = b
		|> reciprocal
		|> * a
]);
norm &= [
	Complex_t z = hypot(z.r, z.i)
];
conjugate &= [
	Complex_t z = Complex(z.r, -z.i)
];
reciprocal &= [
	Complex_t z = z
		|> conjugate
		|> / $(norm(z) ^ 2)
];
`.trim());

const round = num => Math.round(num * 1e3) / 1e3;

currentScope["linReg"] = new Operator([
	[new Type("real", [null, null]), "points"]
], points => {
	if (points.toArray()[0].length === 2) {
		const [x, y] = currentScope.zip.operate(points).toArray();
		points = points.toArray();

		const xbar = currentScope.mean.operate(new List(x));
		const ybar = currentScope.mean.operate(new List(y));

		let sdx = 0;
		let sdy = 0;

		let numerator = 0;
		let denominator = 0;
		for (let i = 0; i < x.length; i++) {
			const xi = x[i];
			const yi = y[i];
			const dx = xi - xbar;
			const dy = yi - ybar;
			numerator += dx * dy;
			denominator += dx * dx;

			sdx += dx ** 2;
			sdy += dy ** 2;
		}

		sdx = Math.sqrt(sdx / x.length);
		sdy = Math.sqrt(sdy / y.length);

		const b = numerator / denominator;
		const a = ybar - xbar * b;
		const r = b * sdx / sdy;

		const operator = new Operator([
			[new Type("real"), "x"]
		], x => a + b * x);

		operator.sourceCode = `(${round(a)} + ${round(b)} * x) /* r: ${round(r)}, r²: ${round(r ** 2)} */`;

		return operator;
	} else {
		const coefs = currentScope.linRegCoefs.operate(points).toArray();
		const operator = new Operator(coefs.slice(1).map((_, i) => [new Type("real"), "x" + (i + 1)]), (...point) => {
			return [1, ...point]
				.map((v, i) => v * coefs[i])
				.reduce((a, b) => a + b, 0);
		});

		operator.sourceCode = `${round(coefs[0])} + ${coefs.slice(1).map((c, i) => round(c) + " x" + (i + 1)).join(" + ")}, /* r²: ${round(currentScope.rSquared.operate(points, operator))} */`;

		return operator;
	}
});

// exec(`
	
// addMultiplier = [
// 	operator base = base
// 			|> operands
// 			|> append real
// 			|> createOperator [
// 				operator() ops = ops(:-1)
// 					|> unwrapCall base
// 					|> * ops(-1)()
// 			];
// ];

// createType(real, { 5, 3, 2, -1, 8 });

// `);

// y = 1.4 + 0.33*x_1 + 0.16*x_2 + e

// exec(`
// 	HISTOGRAM_BUCKETS = 100;
// 	BUCKET_WIDTH = 30;
// 	data = rangeTo 400
// 		|> fill random;
// 		// |> map [real z = z |> - 0.5 |> * 6 |> invNorm 0 1];
// 	bucketSize = data
// 		|> range
// 		|> / HISTOGRAM_BUCKETS;
// 	quantized = data
// 		|> / bucketSize
// 		|> floor;
// 	buckets = rangeTo HISTOGRAM_BUCKETS
// 		|> [
// 			real bucket = quantized
// 				|> filter [
// 					real v = v
// 						|> == bucket
// 				]
// 				|> len
// 		];
// 	graphUnder [
// 		real x = x
// 			|> / BUCKET_WIDTH
// 			|> floor
// 			|> clamp 0 -(HISTOGRAM_BUCKETS, 1)
// 			|> nthOf buckets
// 	] 0 *(HISTOGRAM_BUCKETS, BUCKET_WIDTH);
// `);