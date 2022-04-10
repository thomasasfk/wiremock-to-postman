let protocolMappings = {
    'https:': 'https',
    'http:': 'http'
};

function promptUserDownload(json, filename) {
    let a = document.createElement('a');
    let blob = new Blob([JSON.stringify(json)],
        {'type': 'application/json;charset=utf-8'});
    a.href = window.URL.createObjectURL(blob);
    a.download = `${filename}.json`;
    a.click();
}

function determineMappingJson(mapping) {
    if (mapping.request && mapping.request.bodyPatterns) {
        try {
            JSON.parse(mapping.request.bodyPatterns[0].equalToJson)
            return true
        } catch (_) {
            return false;
        }
    }
    return false;
}

function createCollectionName(mappingUrl) {
    return `${mappingUrl.toString().slice(0, -1)} ${Math.floor(new Date().getTime() / 1000)}`;
}

function mapIndividualRequest(mapping, uniqueUrlPath, idx) {
    let hasBody = mapping.request
        && mapping.request.bodyPatterns
        && Array.isArray(mapping.request.bodyPatterns)
        && mapping.request.bodyPatterns.length > 0;
    let isJson = hasBody ? determineMappingJson(mapping) : false;

    let rawBody = null;
    if (hasBody) {
        rawBody = isJson ? mapping.request.bodyPatterns[0].equalToJson : mapping.request.bodyPatterns[0].equalTo;
    }

    return {
        'name': `${uniqueUrlPath} ${idx}`,
        'protocolProfileBehavior': {
            'disableBodyPruning': true
        },
        'request': {
            'method': mapping.request.method,
            'header': Object.keys(mapping.request.headers || {}).map(key => {
                return {
                    'key': key,
                    'value': (mapping.request.headers || {})[key].equalTo,
                    'type': 'text'
                }
            }),
            'body': {
                'mode': 'raw',
                'raw': rawBody,
                'options': isJson ? {
                    'raw': {
                        'language': 'json'
                    }
                } : {}
            },
            'url': {
                'raw': `${stubMappingsUrl.toString().slice(0, -1)}${uniqueUrlPath}`,
                'protocol': protocolMappings[stubMappingsUrl.protocol] ?
                    protocolMappings[stubMappingsUrl.protocol] : stubMappingsUrl.protocol,
                'host': stubMappingsUrl.host.split('.'),
                'path': uniqueUrlPath.split('/'),
                'query': Array.from(stubMappingsUrl.searchParams).map(([key, value]) => {
                    return {
                        'key': key,
                        'value': value
                    };
                })
            }
        },
        'response': []
    }
}

function getRequestsByUniqueUrl(stubMappingsJson) {
    return stubMappingsJson.mappings.reduce((acc, m) => {
        if (m.request && m.request.url) {
            let url = m.request.url;
            if (acc[url]) {
                acc[url].push(m);
            } else {
                acc[url] = [m];
            }
        }
        return acc;
    }, {});
}

function createPostmanCollection(requestsByUniqueUrl) {
    return {
        'info': {
            'name': collectionName,
            'schema': 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        'item': Object.keys(requestsByUniqueUrl).map(uniqueUrlPath => {
            let mappings = requestsByUniqueUrl[uniqueUrlPath];
            return {
                'name': uniqueUrlPath,
                'item': mappings.map((mapping, idx) => {
                    return mapIndividualRequest(mapping, uniqueUrlPath, idx);
                })
            }
        })
    };
}

async function handleChange(event) {
    let item;
    try {
        let element = document.getElementById('stub-mappings-url');
        stubMappingsUrl = new URL(element.value);
        item = event.target.files.item(0);
    } catch (e) {
        alert('Error, invalid stub mapping url');
        return;
    }

    let stubMappingsText = await item.text();
    let stubMappingsJson = JSON.parse(stubMappingsText);
    let requestsByUniqueUrl = getRequestsByUniqueUrl(stubMappingsJson)

    collectionName = createCollectionName(stubMappingsUrl)
    postmanCollection = createPostmanCollection(requestsByUniqueUrl)

    promptUserDownload(postmanCollection, collectionName);
}

// global just for ease
let stubMappingsUrl;
let collectionName;
let postmanCollection;
document.getElementById('stub-mappings-input').onchange = handleChange;
document.getElementById('stub-mappings-download').onclick = () => {
    promptUserDownload(postmanCollection, createCollectionName(stubMappingsUrl));
};