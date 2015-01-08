(function (global) {
    function getIntersections(circleA, circleB) {
        var x0 = circleA.x,
            y0 = circleA.y,
            x1 = circleB.x,
            y1 = circleB.y,
            r0 = circleA.r,
            r1 = circleB.r,
            dx = x1 - x0,
            dy = y1 - y0,
            d  = Math.sqrt(dx * dx + dy * dy); // distance between the centers

        if (d > (r0 + r1))          return []; // no intersection
        if (d < Math.abs(r0 - r1))  return []; // no intersection, one circle is inside the other

        var a  = ((r0 * r0) - (r1 * r1) + (d * d)) / (2.0 * d),
            x2 = x0 + (dx * a / d),
            y2 = y0 + (dy * a / d),
            h  = Math.sqrt(r0 * r0 - a * a);

        if (h === 0) return [{ x: x2, y: y2 }]; // circles have one common point

        // the offsets of the intersection points
        var rx = -dy * (h / d),
            ry = dx * (h / d);

        return [
            { x: x2 + rx, y: y2 + ry }, 
            { x: x2 - rx, y: y2 - ry }
        ];
    }

    function computeCircles(params) {
        var currentCentralNodeIndex = 0, // central node is like center of orbit on which other nodes are orbiting
            Tolerance = 0.000001, // accuracy error allowed for floating point calculations
            data = getData(params),
            nodes = data.reduce(produceNodes, []); // foldl

        if (params.positiveCoordinates) {
            moveNodesToPositveCoordinates(nodes);
        }

        return {
            dataToPlot: nodes,
            dimensions: getDimensions(nodes)
        };

        function produceNodes (xs, x) {
            var currentNodeRadius = computeRadius(provideValue(x)),
                lastNode = last(xs);

            if (xs.length === 0) {
                return xs.concat([new Node(x, 0, 0, currentNodeRadius)]);
            }

            if (xs.length === 1) {
                return xs.concat([createSecondNode(lastNode, x, currentNodeRadius)]);
            }

            if (currentCentralNodeIndex !== 0) {
                var secondNextToCentralNode = xs[currentCentralNodeIndex + 2],
                    currentNodeDiameter = 2 * currentNodeRadius,
                    canCurrentCircleFitInBetweenNodes = distanceBetweenCircles(secondNextToCentralNode, lastNode) + Tolerance > currentNodeDiameter;

                if (!canCurrentCircleFitInBetweenNodes) {
                    currentCentralNodeIndex++;
                }
            }

            var currentCentralNode = xs[currentCentralNodeIndex],
                oneBeforeLastNode = xs[xs.length - 2],
                nextToCentralNode = xs[currentCentralNodeIndex + 1],
                possibleAdjacentNodes = [currentCentralNode, lastNode];

            if (nextToCentralNode !== lastNode) {
                possibleAdjacentNodes.push(nextToCentralNode);
            }

            var pairs = getPairs(possibleAdjacentNodes.map(function(element) {
                return new Node(element.data, element.x, element.y, element.r + currentNodeRadius)
            }));

            var matchingIntersections = pairs
                .map(getIntersectionsForPair)
                .reduce(function(a, b) {
                    return a.concat(b);
                })
                .filter(function(intersection) {
                    var hasColision = possibleAdjacentNodes.some(function(element) {
                        var distanceBetweenCircles = distanceFromPoints(element, intersection) - (element.r + currentNodeRadius);
                        return distanceBetweenCircles < -Tolerance;
                    });

                    return !hasColision;
                })
                .filter(function(intersection) {
                    return areCirclesAdjacent(lastNode, { x: intersection.x, y: intersection.y, r: currentNodeRadius });
                });

            var intersectionOnProperDirection;

            if (xs.length === 2) {
                intersectionOnProperDirection = matchingIntersections.filter(function(element) { return checkInitialDirection(params, lastNode, element); })[0];
            }
            else {
                intersectionOnProperDirection = maxBy(matchingIntersections, function(element) { return distanceFromPoints(element, oneBeforeLastNode); });
            }

            var newNode = new Node(x, intersectionOnProperDirection.x, intersectionOnProperDirection.y, currentNodeRadius);

            if (!areCirclesAdjacent(currentCentralNode, newNode)) {
                currentCentralNodeIndex++;
            }
            
            xs.push(newNode);
            return xs;
        }

        function Node(data, x, y, r) {
            this.data = data;
            this.x = x;
            this.y = y;
            this.r = r;
        }

        function provideValue(data) {
            var selector = params.valueSelector || function() { return data.value; };
            return selector(data);
        }

        function distanceBetweenCircles(a, b) {
            return distanceFromPoints(a, b) - (a.r + b.r)
        }

        function areCirclesAdjacent(a, b) {
            return Math.abs(distanceFromPoints(a, b) - (a.r + b.r)) < Tolerance;
        }

        function createSecondNode(centralNode, data, radius) {
            var x = 0,
                y = 0;

            switch (params.startPosition) {
                case "top":
                    y = centralNode.r + radius;
                    break;
                case "left":
                    x = - centralNode.r - radius;
                    break;
                case "bottom":
                    y = - centralNode.r - radius;
                    break;
                default: // "right"
                    x = centralNode.r + radius;
                    break;
            }

            return new Node(data, x, y, radius);
        }

        function checkInitialDirection(params, secondNode, pointToCheck) {
            switch (params.startPosition) {
                case "top":
                    return params.clockwise
                        ? (pointToCheck.x > secondNode.x && pointToCheck.y < secondNode.y)
                        : (pointToCheck.x < secondNode.x && pointToCheck.y < secondNode.y)
                case "left":
                    return params.clockwise
                        ? (pointToCheck.x > secondNode.x && pointToCheck.y > secondNode.y)
                        : (pointToCheck.x > secondNode.x && pointToCheck.y < secondNode.y)
                case "bottom":
                    return params.clockwise
                        ? (pointToCheck.x < secondNode.x && pointToCheck.y > secondNode.y)
                        : (pointToCheck.x > secondNode.x && pointToCheck.y > secondNode.y)
                default: // "right"
                    return params.clockwise
                        ? (pointToCheck.x < secondNode.x && pointToCheck.y < secondNode.y)
                        : (pointToCheck.x < secondNode.x && pointToCheck.y > secondNode.y) // default
            }
        }

        function moveNodesToPositveCoordinates(xs) {
            var offsets = xs.reduce(function(offsets, node) {
                var extremePointOnX = node.x - node.r,
                    extremePointOnY = node.y - node.r;

                if (extremePointOnX < offsets.x) {
                    offsets.x = extremePointOnX;
                }

                if (extremePointOnY < offsets.y) {
                    offsets.y = extremePointOnY;
                }

                return offsets;
            }, { x: 0, y: 0 });

            xs.forEach(function(element) {
                element.x = element.x - offsets.x;
                element.y = element.y - offsets.y;
            });
        }

        function getDimensions(xs) {
            var dimensions = xs.reduce(function(dimensions, node) {
                var minXPoint = node.x - node.r,
                    maxXPoint = node.x + node.r,
                    minYPoint = node.y - node.r,
                    maxYPoint = node.y + node.r;

                dimensions.minX = Math.min(minXPoint, dimensions.minX);
                dimensions.maxX = Math.max(maxXPoint, dimensions.maxX);
                dimensions.minY = Math.min(minYPoint, dimensions.minY);
                dimensions.maxY = Math.max(maxYPoint, dimensions.maxY);

                return dimensions;
            }, { minX: 0, maxX: 0, minY: 0, maxY: 0 });

            return dimensions;
        }

        function maxBy(xs, selector) {
            return singleBy(xs, selector, function(prev, current) {
                return prev < current;
            });
        }

        function minBy(xs, selector) {
            return singleBy(xs, selector, function(prev, current) {
                return prev > current;
            });
        }

        // comparer: function(prev, current)
        function singleBy(xs, selector, comparer) {
            var result = xs[0],
                maxValue = result == null ? null : selector(result);

            for (var i = 1; i < xs.length; i++) {
                var currentElement = xs[i];

                if (comparer(maxValue, selector(currentElement))) {
                    maxValue = selector(currentElement);
                    result = currentElement;
                }
            }

            return result;
        }

        function getIntersectionsForPair(pair) {
            return getIntersections(pair[0], pair[1]);
        }

        function distanceFromPoints(a, b) {
            var dx = a.x - b.x,
                dy = a.y - b.y;

            return Math.sqrt(dx * dx + dy * dy);
        }

        function getPairs(xs) {       
            switch (xs.length) {
                case 3:
                    return [
                        [ xs[0], xs[1] ], 
                        [ xs[0], xs[2] ],
                        [ xs[1], xs[2] ]
                    ];
                case 2:
                    return [
                        [xs[0], xs[1]]
                    ];
                default:
                    return createPairs(xs);
            }
        }

        function createPairs(xs) {
            if (xs.length < 2) {
                return [];
            }

            var head  = getHead(xs),
                tail  = getTail(xs),
                pairs = tail.map(function(element) {
                    return [head, element];
                });

            return pairs.concat(getPairs(tail))
        }

        function getData(params) {
            switch (params.dataType) {
                case "json":
                    return getJson();
                case "object":
                    return getObject();
                default: // "auto"
                    if (typeof(params.data) === "string") {
                        return getJson();
                    }
                    return getObject();
            }

            function getJson() {
                var obj = JSON.parse(params.data);
                return obj[Object.keys(obj)[0]];
            }

            function getObject() {
                return params.data;
            }
        }

        function getHead(xs) {
            return xs[0];
        }

        function getTail(xs) {
            return xs.slice(1);
        }

        function last(xs) {
            return xs[xs.length - 1];
        }

        function computeRadius(area) {
            return 0.56418958 * Math.sqrt(area);
        }

        function computeDiameter(area) {
            return 1.12837916 * Math.sqrt(area);
        }
    }

    global.snail = {
        Generate: computeCircles
    }
})(window);