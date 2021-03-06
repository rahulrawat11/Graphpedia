// term.js
// Term model logic.

var neo4j = require('neo4j');
var db = new neo4j.GraphDatabase(
    process.env['NEO4J_URL'] ||
    process.env['GRAPHENEDB_URL'] ||
    'http://localhost:7474'
);
var Relationship = require('./relationship');

// private constructor:

var Term = module.exports = function Term(_node) {
    // all we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
}

// public instance properties:

Object.defineProperty(Term.prototype, 'id', {
    get: function () { return this._node.id; }
});



Object.defineProperty(Term.prototype, 'data', {
    get: function () { return this._node.data; }
});

Object.defineProperty(Term.prototype, 'name', {
    get: function () {
        return this._node.data['name'];
    },
    set: function (name) {
        this._node.data['name'] = name;
    }
});

//Added lower case name for easy searching of the term
Object.defineProperty(Term.prototype, 'name_lower_case', {
    get: function () {
        return this._node.data['name_lower_case'];
    },
    set: function (name_lower_case) {
        this._node.data['name_lower_case'] = name_lower_case;
    }
});

//Added description field for term
Object.defineProperty(Term.prototype, 'description', {
    get: function () {
        return this._node.data['description'];
    },
    set: function (description) {
        this._node.data['description'] = description;
    }
});

//Added created_at field for term
Object.defineProperty(Term.prototype, 'created_at', {
    get: function () {
        return this._node.data['created_at'];
    },
    set: function (created_at) {
        this._node.data['created_at'] = created_at;
    }
});

//Added last_viewed_at field for term
Object.defineProperty(Term.prototype, 'last_viewed_at', {
    get: function () {
        return this._node.data['last_viewed_at'];
    },
    set: function (last_viewed_at) {
        this._node.data['last_viewed_at'] = last_viewed_at;
    }
});

//Added last_modified_at field for term
Object.defineProperty(Term.prototype, 'last_modified_at', {
    get: function () {
        return this._node.data['last_modified_at'];
    },
    set: function (last_modified_at) {
        this._node.data['last_modified_at'] = last_modified_at;
    }
});

//Added relationship count for term
Object.defineProperty(Term.prototype, 'rel_count', {
    get: function () {
        return this._node.data['rel_count'];
    },
    set: function (rel_count) {
        this._node.data['rel_count'] = rel_count;
    }
});

// public instance methods:

Term.prototype.save = function (callback) {
    this._node.save(function (err) {
        callback(err);
    });
};

Term.prototype.del = function (callback) {
    // use a Cypher query to delete both this Term and his/her following
    // relationships in one transaction and one network request:
    // (note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
        'MATCH (term:Term)',
        'WHERE ID(term) = {termId}',
        'OPTIONAL MATCH term-[r]-()',
        'DELETE r, term',
    ].join('\n')

    var params = {
        termId: this.id
    };
    db.query(query, params, function (err) {
        console.log('%s', "Term deleted");
        callback(err);
    });
};

/*  New/Delete relationship
    Currently we have cutomized relationships
*/

//Customized relationship methods
//Added reverse relationship creation mechanism
Term.prototype.custom = function (other, relationship_name, callback) {
    var formated_relationship_name = relationship_name.replace(/ /g,"_");
    var self = this;
    this._node.createRelationshipTo(other._node, formated_relationship_name, {}, function (err, rel) {
        // Construct model instance
        var relationship = new Relationship();
        var reverse_rel = relationship.getReverse(formated_relationship_name);
        if(reverse_rel != null){
            // Exists reverse relationship, create it
            console.log("Exists reverse relationship: " + reverse_rel);
            other._node.createRelationshipTo(self._node, reverse_rel, {}, function (err, rel2) {
                callback(err);
            });
        }else{
            callback(err);
        }
    });
};

Term.prototype.uncustom = function (other, relationship_name, callback) {
    //Create MATCH query
    var formated_relationship_name = relationship_name.replace(/ /g,"_");
    console.log("in uncustom: "+ formated_relationship_name);
    var match_rel = 'MATCH (term:Term) -[rel:'+formated_relationship_name+']-> (other:Term)'
    var query = [
        match_rel,
        'WHERE ID(term) = {termId} AND ID(other) = {otherId}',
        'DELETE rel',
    ].join('\n')

    var params = {
        termId: this.id,
        otherId: other.id,
    };

    db.query(query, params, function (err) {
        callback(err);
    });
};

// calls callback w/ (err, outgoing, others) where outgoing is an array of
// Terms this Term outgoes, and others is all other Terms minus him/herself.
// To search for all relationships, use
// MATCH (n:Term), n-[r]-m, (m:Term) WHERE n.`name`="nodejs"   RETURN n, type(r)

Term.prototype.getOutgoingAndOthers = function (callback) {
    //Construct neo4j raw query
    var query = [
        'MATCH (term:Term), (other:Term)',
        'OPTIONAL MATCH (term) -[relall]-> (other)',
        'WHERE ID(term) = {termId}',
        'RETURN other, COUNT(relall), type(relall)',
        // COUNT(rel) is a hack for 1 or 0, 1 indicates there is an outgoing relationship.
    ].join('\n')

    var params = {
        termId: this.id,
    };

    var term = this;
    db.query(query, params, function (err, results) {
        if (err) return callback(err);
        //Count the total number of related terms
        //Use two arrays to store the name of relationship and the corresponding term
        var rel_names = [];
        var rel_terms = [];
        var all_others = [];

        for (var i = 0; i < results.length; i++) {
            var other = new Term(results[i]['other']);
            //Check if the result term is related to the term query
            related_true = results[i]['COUNT(relall)'];

            if (term.id === other.id) {
                continue;
            } else {
                //All terms except for itself is in all others
                //Problem: This becomes expensive if number of term get very big
                all_others.push(other);
                if(related_true){
                    //The terms are related
                    //Add the name of the relationship and the term into the arrays
                    rel_names.push(results[i]['type(relall)']);
                    rel_terms.push(other);
                }
            }
        }
        callback(null, all_others, rel_names, rel_terms);
    });
};

// static methods:

Term.get = function (id, callback) {
    db.getRelationshipIndexes(function (err, indexes) { 
        if (err) throw err; 
        indexes.forEach(function (name) { 
            console.log('Index'+ name+ 'has config:'+ indexes[name]); 
        }); 
    });
    db.getNodeById(id, function (err, node) {
        if (err) return callback(err);
        callback(null, new Term(node));
    });
};

/**
 * Get a term by name
 */
//Provided support for searching with lower case
Term.getByName = function (name, callback) {
    //Convert the name to lower case before searching
    if(name == null || name == ""){
        return callback("err");
    }
    var name_lower_case = name.toLowerCase();
    var query = [
        'MATCH (term:Term)',
        'WHERE term.name = {termName} OR term.name_lower_case = {termName}',
        'RETURN term',
    ].join('\n');

    var params = {
        termName: name_lower_case,
    };

    db.query(query, params, function (err, results) {
        if (err) return callback(err);
        var terms = results.map(function (result) {
            return new Term(result['term']);
        });
        callback(null, terms);
    });
};

/**
 * Get 2 terms by names for path
 */
//Provided support for searching with lower case
Term.getByNames = function (name1, name2, callback) {
    Term.getByName(name1, function (err, terms1) {
        if (err) return callback(err);
        Term.getByName(name2, function (err2, terms2){
            if (err2) return callback(err);
            callback(null, terms1, terms2); 
        });
    });
};

/**
 * Get the count of total number of relationships
 * @param  {Function} callback 
 * @return {int}            count
 */
Term.getRelationshipCount = function(callback){
    var query = [
        'MATCH (n:Term)-[r]->(m:Term)',
        'RETURN count(r)',
    ].join('\n');

    db.query(query, null, function (err, results) {
        if (err) return callback(err);
        callback(null, results[0]['count(r)']);
    });
}

/**
 * Get a term by partial name, used if full matching is not possible
 */
//Provided support for partial matching using regular expression
//13 July
Term.getByNamePartial = function (name, callback) {
    // console.log('%s', "inside getByNamePartial");
    if(name == null || name == ""){
        return callback("err");
    }
    //Convert the name to lower case before searching
    var name_lower_case = name.toLowerCase();
    //Construct regexp: case-insensitive, partial match with .*
    var regexp = '(?i).*' + name_lower_case + '.*';
    // console.log('%s', "regexp: " + regexp);
    var query = [
        'MATCH (term:Term)',
        'WHERE term.name =~ ' + "'" + regexp + "'",
        'RETURN term',
    ].join('\n');

    db.query(query, null, function (err, results) {
        if (err) return callback(err);
        var terms = results.map(function (result) {
            return new Term(result['term']);
        });
        callback(null, terms);
    });
};

Term.getAll = function (callback) {
    var query = [
        'MATCH (term:Term)',
        'RETURN term',
    ].join('\n');

    db.query(query, null, function (err, results) {
        if (err) return callback(err);
        var terms = results.map(function (result) {
            return new Term(result['term']);
        });
        callback(null, terms);
    });
};

/**
 * Get the recent terms
 * @param  {Function} callback 
 * @return {array}    terms
 */
Term.getRecent = function (callback) {
    var query = [
        'MATCH (term:Term)',
        'WHERE HAS (term.last_viewed_at)',
        'RETURN term ORDER BY term.last_viewed_at DESC LIMIT 12',
    ].join('\n');

    db.query(query, null, function (err, results) {
        if (err) return callback(err);
        var terms = results.map(function (result) {
            return new Term(result['term']);
        });
        // terms.forEach(function (term) {
        //     console.log(term.name);
        // });
        callback(null, terms);
    });
}

/**
 * Get the terms with least number of relationships(alone ones)
 * @param  {Function} callback 
 * @return {array}    terms
 */
Term.getAlone = function (callback) {
    var query = [
        'MATCH (term:Term), (other:Term)',
        'OPTIONAL MATCH term-[r]->other',
        'RETURN term, COUNT(r) ORDER BY COUNT(r) LIMIT 5',
    ].join('\n');

    db.query(query, null, function (err, results) {
        if (err) return callback(err);
        var terms = results.map(function (result) {
            return new Term(result['term']);
        });
        var rel_counts = results.map(function (result) {
            return result['COUNT(r)'];
        });
        // terms.forEach(function (term) {
        //     console.log("In terms: " + term.name);
        // });
        callback(null, terms, rel_counts);
    });
}

/**
 * Get the total number of terms
 * @param  {Function} callback callback
 * @return {[type]}            count
 */
Term.getCount = function (callback) {
    var query = [
        'MATCH (term:Term)',
        'RETURN COUNT(term)',
    ].join('\n');

    db.query(query, null, function (err, results) {
        if (err) return callback(err);
        callback(null, results[0]['COUNT(term)']);
    });
};

// creates the Term and persists (saves) it to the db, incl. indexing it:
Term.create = function (data, callback) {
    // construct a new instance of our class with the data, so it can
    // validate and extend it, etc., if we choose to do that in the future:
    var node = db.createNode(data);
    var term = new Term(node);
    // console.log(data);
    // but we do the actual persisting with a Cypher query, so we can also
    // apply a label at the same time. (the save() method doesn't support
    // that, since it uses Neo4j's REST API, which doesn't support that.)

    var query = [
        'CREATE (term:Term {data})',
        'RETURN term',
    ].join('\n');

    var params = {
        data: data
    };

    db.query(query, params, function (err, results) {
        if (err) return callback(err);
        var term = new Term(results[0]['term']);
        callback(null, term);
    });
};

// creates multiple terms in one operation and persists (saves) them to the db, incl. indexing it:
Term.createMultiple = function (data, callback) {
    // construct a new instance of our class with the data, so it can
    // validate and extend it, etc., if we choose to do that in the future:
    // var node = db.createNode(data);
    // var term = new Term(node);
    // console.log(data);
    // but we do the actual persisting with a Cypher query, so we can also
    // apply a label at the same time. (the save() method doesn't support
    // that, since it uses Neo4j's REST API, which doesn't support that.)
    var query = [
        'CREATE (term:Term {data})',
        'RETURN count(term)',
    ].join('\n');

    var params = {
        data: data
    };

    db.query(query, params, function (err, results) {
        if (err) return callback(err);
        // console.log(results[0]);
        var count = results[0]['count(term)'];
        callback(null, count);
    });
};

/**
 * Get the path from one node to another
 * @param  {Term}   other    the other term
 * @param  {callback} callback the callback with the nodes and relationships as arrays
 * @return {none}
 * @author paradite
 */
Term.prototype.getPath = function (other, callback) {
/*
MATCH (actor { name:'Charlie Sheen' })-[r:ACTED_IN*2]-(co_actor)
RETURN r
 */
    var match_term = 'MATCH (term:Term),(other:Term),';
    var match_path = ' p = shortestPath((term)-[r*..6]->(other))';
    var query = [
        match_term + match_path,
        'WHERE ID(term) = {termId} AND ID(other) = {otherId}',
        'RETURN nodes(p), relationships(p)',
    ].join('\n')

    var params = {
        termId: this.id,
        otherId: other.id,
    };

/*    this._node.path(other._node, rels, 'all', 5, 'shortestPath', function (err, path){
        if(err) console.log(err);
        console.log(path.nodes);
    });*/

    db.query(query, params, function (err, results) {
        if (err) return callback(err);
        results = results[0];
        // console.log(results);
        if(!results){
            return callback(null, [], []);
        }
        var nodes = results['nodes(p)'];
        var relationships = results['relationships(p)'];
        var terms = nodes.map(function (node) {
            return new Term(node);
        });
        terms.forEach(function (term){
            // console.log(term.name + ":" + term.description);
        });
        relationships.forEach(function (relationship){
            // console.log("relationship type:" + relationship.type);
        });
        // data = nodes[0].data;
        // console.log("results: " + results + " nodes: " + nodes + " 1st data: ");
        callback(null, terms, relationships);
    });
    
}

/*
Method to parse the data from neo4j databse to json objects for rendering of d3.js
Author: Zhu Liang
Date: 29 June
*/
Term.prototype.parse = function (req, arr_obs){
    var parsed = [];
    for (var item in arr_obs) {
        if(!arr_obs[item].description){
            arr_obs[item].description = "no description yet"
        }
        // console.log("id: " + arr_obs[item].id);
        parsed.push({name: arr_obs[item].name, description: arr_obs[item].description, term_url: req.get('Host') + "/terms/" + arr_obs[item].id});
    }
    return parsed;
}

/*MATCH n RETURN n LIMIT 5;*/


/*Old methods*/
/*
// calls callback w/ (err, including, others) where including is an array of
// Terms this Term contains, and others is all other Terms minus him/herself.
// To search for all relationships, use
// MATCH (n:Term), n-[r]-m, (m:Term) WHERE n.`name`="nodejs"   RETURN n, type(r)
Term.prototype.getContainingAndOthers = function (callback) {
    // query all Terms and whether we follow each one or not:
    var query = [
        'MATCH (term:Term), (other:Term)',
        'OPTIONAL MATCH (term) -[rel:contains]-> (other)',
        'WHERE ID(term) = {termId}',
        'RETURN other, COUNT(rel)', // COUNT(rel) is a hack for 1 or 0
    ].join('\n')

    var params = {
        termId: this.id,
    };

    var term = this;
    db.query(query, params, function (err, results) {
        if (err) return callback(err);

        var including = [];
        var others = [];

        for (var i = 0; i < results.length; i++) {
            var other = new Term(results[i]['other']);
            var contains = results[i]['COUNT(rel)'];

            if (term.id === other.id) {
                continue;
            } else if (contains) {
                including.push(other);
            } else {
                others.push(other);
            }
        }

        callback(null, including, others);
    });
};



// calls callback w/ (err, following, others) where following is an array of
// Terms this Term follows, and others is all other Terms minus him/herself.
// TODO:
// For all others, only send those not related to the term.
Term.prototype.getFollowingAndOthers = function (callback) {
    // query all Terms and whether we follow each one or not:
    var query = [
        'MATCH (term:Term), (other:Term)',
        'OPTIONAL MATCH (term) -[rel:follows]-> (other)',
        'WHERE ID(term) = {termId}',
        'RETURN other, COUNT(rel)', // COUNT(rel) is a hack for 1 or 0
    ].join('\n')

    var params = {
        termId: this.id,
    };

    var term = this;
    db.query(query, params, function (err, results) {
        if (err) return callback(err);

        var following = [];
        var others = [];

        for (var i = 0; i < results.length; i++) {
            var other = new Term(results[i]['other']);
            var follows = results[i]['COUNT(rel)'];

            if (term.id === other.id) {
                continue;
            } else if (follows) {
                following.push(other);
            } else {
                others.push(other);
            }
        }

        callback(null, following, others);
    });
};
*/

/*
//follow related methods
Term.prototype.follow = function (other, callback) {
    this._node.createRelationshipTo(other._node, 'follows', {}, function (err, rel) {
        callback(err);
    });
};

Term.prototype.unfollow = function (other, callback) {
    var query = [
        'MATCH (term:Term) -[rel:follows]-> (other:Term)',
        'WHERE ID(term) = {termId} AND ID(other) = {otherId}',
        'DELETE rel',
    ].join('\n')

    var params = {
        termId: this.id,
        otherId: other.id,
    };

    db.query(query, params, function (err) {
        callback(err);
    });
};

//is_part_of related methods
Term.prototype.is_part_of = function (other, callback) {
    this._node.createRelationshipTo(other._node, this.REL_IS_PART_OF, {}, function (err, rel) {
        callback(err);
    });
};

Term.prototype.unis_part_of = function (other, callback) {
    var query = [
        'MATCH (term:Term) -[rel:'+this.REL_IS_PART_OF+']-> (other:Term)',
        'WHERE ID(term) = {termId} AND ID(other) = {otherId}',
        'DELETE rel',
    ].join('\n')

    var params = {
        termId: this.id,
        otherId: other.id,
    };

    db.query(query, params, function (err) {
        callback(err);
    });
};

//contains related methods
Term.prototype.contain = function (other, callback) {
    this._node.createRelationshipTo(other._node, this.REL_INCLUDE, {}, function (err, rel) {
        callback(err);
    });
};

Term.prototype.uncontain = function (other, callback) {
    var query = [
        'MATCH (term:Term) -[rel:'+this.REL_INCLUDE+']-> (other:Term)',
        'WHERE ID(term) = {termId} AND ID(other) = {otherId}',
        'DELETE rel',
    ].join('\n')

    var params = {
        termId: this.id,
        otherId: other.id,
    };

    db.query(query, params, function (err) {
        callback(err);
    });
};

//Define relationships
Object.defineProperty(Term.prototype, 'REL_IS_PART_OF', {
    get: function () { return "is_part_of"; }
});

Object.defineProperty(Term.prototype, 'REL_INCLUDE', {
    get: function () { return "includes"; }
});

Object.defineProperty(Term.prototype, 'REL_SUCCESSOR', {
    get: function () { return "is_successor_of"; }
});

Object.defineProperty(Term.prototype, 'REL_PREDECESSOR', {
    get: function () { return "is_predecessor_of"; }
});

Object.defineProperty(Term.prototype, 'REL_DEPEND', {
    get: function () { return "depends_on"; }
});

Object.defineProperty(Term.prototype, 'REL_SYNONYM', {
    get: function () { return "is_synonym_for"; }
});

Object.defineProperty(Term.prototype, 'REL_RELATED', {
    get: function () { return "is_related_to"; }
});

// Method to return all the relationships
Term.prototype.getAllRelationships = function() {
    return [
    this.REL_INCLUDE.replace(/_/g," "),
    this.REL_DEPEND.replace(/_/g," "),
    this.REL_PREDECESSOR.replace(/_/g," "),
    this.REL_SUCCESSOR.replace(/_/g," "),
    this.REL_IS_PART_OF.replace(/_/g," "),
    this.REL_RELATED.replace(/_/g," ")
    ];
}

*/