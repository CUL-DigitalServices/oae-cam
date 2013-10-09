/*!
 * Copyright 2013 Apereo Foundation (AF) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *     http://opensource.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

define(['jquery', 'oae.core', '../lib/d3.js', '../lib/kinetic.js', '../lib/meteorcharts.js'], function($, oae, dthree, kinetic, MeteorCharts) {

    return function(uid, showSettings, widgetData) {

        //////////////////////
        // WIDGET VARIABLES //
        //////////////////////

        // The widget container
        var $rootel = $('#' + uid);

        var userProfile = null;
        var myProfile = null;

        ////////////
        // MODELS //
        ////////////

        var activity = function() {
            return {
                'name': '',
                'activities': {}, 
                'color': ''
            }
        }

        var objYear = function() {
            var date = new Date();
            var retVal = {};
            for (i = 0; i < date.getMonth() + 1; i++){
                retVal[i+1] = 0;
            }
            return retVal;           
        };        

        ////////////////////
        // VISUAL METHODS //
        ////////////////////

        /**
         * Generates a chart based on the 
         */
        var generateActivityChart = function(userItems, myItems) {

            // Models
            var model = {
                'title': 'Activity indicator', 
                'series': []
            };

            // View configuration
            var view = {
                'width': 1000,
                'height': 400,
                'backgroundColor': 'white',
                'padding': 20,
                'text': {
                  'fill': '#444'
                },                
                'series': []
            }; 

            // Methods
            var objYear = function() {
                var date = new Date();
                var retVal = {};
                for (i = 0; i < date.getMonth() + 1; i++){
                    retVal[i+1] = 0;
                }
                return retVal;           
            };

            var _populateCollection = function(items) {
                var col = new objYear();
                _.each(items, function(item) {
                    var date = new Date(Number(item.created));
                    var m = date.getMonth() + 1;
                    col[m]++;
                });
                return col;
            };
              
            var _createActivityObject = function(name, collection, color) {
                var ac = {
                  'title': name,
                  'points': [] 
                }
                _.each(collection, function(val, key) {
                    ac.points.push({'x': key, 'y': val})
                });
                view.series.push({'stroke': color});
                model.series.push(ac);
            };

            var myActivity = _createActivityObject(oae.data.me.displayName, _populateCollection(myItems), 'red');
            var userActivity = _createActivityObject(userProfile.displayName, _populateCollection(userItems), 'blue');

            // Create a new lineChart
            var lineChart = new MeteorCharts.Line({
                'container': 'visualisation-activity-widget',
                'model': model,
                'view': view
            });
        };

        // Create the model for the graphs
        var createNetworkChartModel = function(userData, myData) {

            var graph = {
                'nodes': [],
                'links': []
            };

            // Function that creates a node model
            var _createNodeModel = function(name, data, group, radius) {
                return {
                    'name': name,
                    'data': data,
                    'group': group,
                    'radius': radius,
                    'users': 1
                }
            };

            // Function that creates a link model
            var _createLinkModel = function(source, target, value) {
                return {
                    'source': source,
                    'target': target,
                    'value': value
                }
            };

            // Function that checks if a collection contains a given object
            var _containsObject = function(obj, list) {
                var res = _.find(list, function(val) {
                    return _.isEqual(obj, val)
                });
                return (_.isObject(res));
            };

            // Function that creates new nodes and adds them to the collection
            var _addNodes = function(collection) {
                var users = 1;
                _.each(collection, function(node, index) {
                    var group = (_.filter(graph.nodes, function(node) { return node.data.resourceType === 'user'; }).length+1);
                    var value = (node.resourceType === 'user') ? 40 : 20;
                    var _node = _createNodeModel(node.displayName, node, group, value);
                    if (!_containsObject(_node, graph.nodes)) {
                        graph.nodes.push(_node);
                    } else {
                        _.each(graph.nodes, function(n) {
                            if (n.data.id === node.id) {
                                n.radius = (n.radius + (n.users * 10));
                                n.users++;
                            }
                        });
                    }
                });
            };

            // Function that creates new links between nodes and adds them to the collection
            var _addLinks = function(source, collection) {
                _.each(collection, function(node, index) {
                    var target = _.indexOf(graph.nodes, _.filter(graph.nodes, function(n) { return node.id === n.data.id })[0]);
                    var link = _createLinkModel(source, target, 2);
                    graph.links.push(link);
                });
            }

            // Add the users
            _addNodes([userProfile, myProfile]);

            // Add the groups
            _addNodes(userData);
            _addNodes(myData);

            // Add the links for selected user
            _addLinks(0, userData);
            _addLinks(1, myData);

            // Draw the graphics
            getNetworkChart(graph);
        };

        var getNetworkChart = function(graph) {

            // Initialize the graphs
            var width = 900;
            var height = 800;
            var color = d3.scale.category20();
            var force = d3.layout.force()
                .charge(-2500)
                .linkDistance( function(d) { 
                    var distance = 80;
                    if (d.target.users > 1) {
                        distance = 120;
                    }
                    return distance;
                })
                .size([width, height]);

            function styles(styles) {
                return function(selection) {
                    for (var property in styles) {
                        selection.style(property, styles[property]);
                    }
                };
            };

            if($('svg')){$('svg').remove()}
            var svg = d3.select("#visualisation-networks-widget")
                .append("svg")
                .attr({
                    'width': width,
                    'height': height
                });

            force
                .nodes(graph.nodes)
                .links(graph.links)
                .start();

            var links = svg.selectAll(".link")
                .data(graph.links)
                .enter()
                .append("line")
                .attr("class", "link")
                .call(styles({
                    "stroke-width": function(d) { return (d.target.users * 2) },
                    "stroke-dasharray": function(d) { return (d.target.users > 1) ? ["6, 6"] : ["3, 3"] }
                }));

            var nodes = svg.selectAll(".node")
                .data(graph.nodes)
                .enter()
                .append("g")
                .attr("class", "node")
                .on("mouseover", highlightNode(0.15, 1.1))
                .on("mouseout", highlightNode(1, 1))
                .on("click", onNodeClick)
                .call(force.drag);

            nodes.append("circle")
                .data(graph.nodes)
                .attr({
                    'r': function(d) { return d.radius; },
                    'title': function(d) { return d.data.displayName; },
                    'class': 'bg'
                })
                .call(styles({
                    "fill": function(d) { return (d.data.resourceType === 'user') ? '#1F77B4' : '#333'; }
                }));

            nodes.append("clipPath")
                .attr({
                    'id': function(d) { return "mask" + d.index}
                })
                .append("circle")
                .data(graph.nodes)
                .attr({
                    'r': function(d) { return d.radius; }
                });

            nodes.append("image")
                .attr({
                    'x': function(d) { return (d.data.resourceType === 'user') ? -45 : -30 }, 
                    'y': function(d) { return (d.data.resourceType === 'user') ? -45 : -30 },
                    'width': function(d) { return (d.data.resourceType === 'user') ? "90px" : "60px" },
                    'height': function(d) { return (d.data.resourceType === 'user') ? "90px" : "60px" },
                    'xlink:href': function(d) { return (d.data.resourceType === 'user') ? d.data.picture.medium : d.data.picture.medium },
                    'clip-path': function(d) { return "url(#mask" + d.index + ")" },
                    'class': 'thumbnail'
                });

            // Node name
            nodes.append("text")
                .attr({
                    'dx': function(d) { return (d.radius) },
                    'dy': function(d) { return (d.radius) }
                })
                .text(function(d) { return d.name; });

            // Group that containts the circle and text for the amount
            nodes.append('g')
                .attr({
                    'class': 'amount'
                });

            // Amount bg
            nodes.selectAll('g.amount')
                .append("circle")
                    .attr({
                        'r': 0,
                        'cx': function(d) { return (d.radius * .8) },
                        'cy': function(d) { return (-(d.radius * .8)) }
                    })
                    .style("fill", function(d) { return (d.data.resourceType === 'user') ? '#1F77B4' : '#333'; })

            // Amount text
            nodes.selectAll('g.amount')
                .append('text')
                    .attr({
                        'dx': function(d) { return (d.radius * .8) },
                        'dy': function(d) { return ((-(d.radius * .8))+5) },
                        'text-anchor': 'middle',
                        'opacity': 0
                    })
                    .call(styles({
                        'fill': '#FFF'
                    }))
                    .text(function(d) { return d.users; })

            force.on("tick", function() {
                links.attr({
                    'x1': function(d) { return d.source.x; },
                    'y1': function(d) { return d.source.y; },
                    'x2': function(d) { return d.target.x; },
                    'y2': function(d) { return d.target.y; }
                })
                nodes.attr({
                    'transform': function(d) { return "translate(" + d.x + "," + d.y + ")"; }
                })
            });

            function onNodeClick(user) {
                //window.location = 'http://cam.oae.com' + user.data.profilePath;
            };

            // Functions that highlights the appropriate node and its dependencies
            function highlightNode(opacity, scale) {
                return function(node, index, g) {

                    // Nodes to be highlighted
                    var nodes = [];

                    // If the selected node is a user, highlight the user and its groups
                    if (node.data.resourceType === 'user') {
                        nodes = getUserGroupsByUser(index);

                    // If the selected node is a group, highlight the group and its users
                    } else if (node.data.resourceType === 'group') {
                        nodes = getUsersByGroup(index);
                    }

                    // Also add the hovered element to the nodes
                    nodes.push(node.index);

                    // Do something with the relevant items
                    var relevantItems = svg.selectAll('.node')
                        .filter(function(n, i) { return ($.inArray(n.index, nodes) > -1); });

                    relevantItems.selectAll('circle.bg')
                        .transition()
                            .attr('r', function(obj) { return obj.radius * scale; });

                    relevantItems.selectAll('g.amount circle')
                        .transition()
                            .attr('r', function(d) { return (opacity === 1) ? 0 : 10 });

                    relevantItems.selectAll('g.amount text')
                        .transition()
                            .attr('opacity', function(d) { return (opacity === 1) ? 0 : 1 });

                    // Do something with the irrelevant items
                    var irrelevantItems = svg.selectAll('.node')
                        .filter(function(n, i) { return ($.inArray(n.index, nodes) < 0); })
                    
                    irrelevantItems.selectAll('circle, image')
                        .transition()
                            .style("opacity", opacity);

                    svg.selectAll('.link')
                        .transition()
                            .style("opacity", opacity);
                };
            };

            // Function that returns all the groups of a user
            function getUserGroupsByUser(index) {
                var groups = [];
                _.each(graph.links, function(link) {
                    if (link.source.index === index) {
                        groups.push(link.target.index);
                    }
                });
                return groups;
            };

            // Function that returns all the users of a group
            function getUsersByGroup(index) {
                var users = [];
                _.each(graph.links, function(link) {
                    if (link.target.index === index) {
                        users.push(link.source.index);
                    }
                });
                return users;
            };
        };

        //////////////////
        // DATA METHODS //
        //////////////////

        /**
         * Gets the user's content items
         */
        var getUserContent = function(useruri, myuri, callback) {
            if (widgetData.principalId) {
                $.ajax({
                    'url': useruri,
                    'success': function(data) {
                        var userData = data.results;
                        $.ajax({
                            'url': myuri,
                            'success': function(data) {
                                var myData =  data.results;
                                callback(userData, myData);
                            },
                            'error': function() {
                                console.error('An error has occured while retrieving the list of your results');
                            }
                        });
                    },
                    'error': function() {
                        console.error('An error has occured while retrieving the list of the user\'s results');
                    }
                });
            } else {
                console.log('No userId provided (principalId)');
            }
        };

        /**
         * Gets the user's networks
         */
        var getUserNetworks = function(useruri, myuri, callback) {
            if (widgetData.principalId) {
                $.ajax({
                    'url': useruri,
                    'success': function(data) {
                        var userData = data.results;
                        $.ajax({
                            'url': myuri,
                            'success': function(data) {
                                var myData = data.results;
                                callback(userData, myData);
                            },
                            'error': function() {
                                console.error('An error has occured while retrieving the list of your results');
                            }
                        });
                    },
                    'error': function() {
                        console.error('An error has occured while retrieving the list of the user\'s results');
                    }
                });
            } else {
                console.log('No userId provided (principalId)');
            }            
        };

        var getUserProfile = function() {
            myProfile = oae.data.me;
            oae.api.user.getUser(widgetData.principalId, function(err, profile) {
                if (err && err.code === 404) {
                    oae.api.util.redirect().notfound();
                } else if (err && err.code === 401) {
                    oae.api.util.redirect().accessdenied();
                }
                // Cache the user profile data
                userProfile = profile;
                getUserContent('/api/content/library/' + widgetData.principalId, '/api/content/library/' + oae.data.me.id, generateActivityChart);
            });
        };

        var toggleTabContent = function(e) {
            switch($(e.target).attr('href')) {
                case '#activity':
                    getUserContent('/api/content/library/' + widgetData.principalId, '/api/content/library/' + oae.data.me.id, generateActivityChart);
                    break;
                case '#networks':
                    getUserNetworks('/api/user/' + widgetData.principalId + '/memberships', '/api/user/' + oae.data.me.id + '/memberships', createNetworkChartModel);
                    break;
            }
        };

        /**
         * Add the different event bindings
         */
        var addBinding = function() {
            $(document).on('shown.bs.tab', toggleTabContent);
        };

        ////////////////////
        // INITIALIZATION //
        ////////////////////

        addBinding();
        getUserProfile();
    };
});
