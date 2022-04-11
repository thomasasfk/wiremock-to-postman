let protocolMappings = {
    'https:': 'https',
    'http:': 'http'
}

function promptUserDownload(json, filename) {
    let a = document.createElement('a')
    let blob = new Blob([JSON.stringify(json)],
        {'type': 'application/jsoncharset=utf-8'})
    a.href = window.URL.createObjectURL(blob)
    a.download = `${filename}.json`
    a.click()
}

function determineMappingJson(mapping) {
    if (mapping.request && mapping.request.bodyPatterns) {
        try {
            JSON.parse(mapping.request.bodyPatterns[0].equalToJson)
            return true
        } catch (_) {
            return false
        }
    }
    return false
}

function createCollectionName(mappingUrl) {
    return `${mappingUrl.toString().slice(0, -1)} ${Math.floor(new Date().getTime() / 1000)}`
}

function mapIndividualRequest(mapping, uniqueUrlPath, idx) {
    let hasBody = mapping.request
        && mapping.request.bodyPatterns
        && Array.isArray(mapping.request.bodyPatterns)
        && mapping.request.bodyPatterns.length > 0
    let isJson = hasBody ? determineMappingJson(mapping) : false

    let rawBody = null
    if (hasBody) {
        rawBody = isJson ? mapping.request.bodyPatterns[0].equalToJson : mapping.request.bodyPatterns[0].equalTo
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
                    }
                })
            }
        },
        'response': []
    }
}

function doesntAlreadyExist(newMapping, existingMappings) {
    return existingMappings
        .filter(existingMapping => {
            return JSON.stringify(existingMapping) === JSON.stringify(newMapping)
        }).length > 0
}

function getRequestsByUniqueUrl(stubMappingsJson) {
    return stubMappingsJson.mappings.reduce((mappingsByUrl, mapping) => {
        if (mapping.request && mapping.request.url) {
            let url = mapping.request.url
            if (mappingsByUrl[url] && doesntAlreadyExist(mapping, mappingsByUrl[url])) {
                mappingsByUrl[url].push(mapping)
            } else {
                mappingsByUrl[url] = [mapping]
            }
        }
        return mappingsByUrl
    }, {})
}

function createPostmanCollection(name, requestsByUniqueUrl) {
    return {
        'info': {
            'name': name,
            'schema': 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        'item': Object.keys(requestsByUniqueUrl).map(uniqueUrlPath => {
            let mappings = requestsByUniqueUrl[uniqueUrlPath]
            return {
                'name': uniqueUrlPath,
                'item': mappings.map((mapping, idx) => {
                    return mapIndividualRequest(mapping, uniqueUrlPath, idx)
                })
            }
        })
    }
}

function createAndSavePostmanCollection(url, requestsByUniqueUrl) {
    let collectionName = createCollectionName(url)
    let postmanCollection

    try {
        postmanCollection = createPostmanCollection(collectionName, requestsByUniqueUrl)
    } catch (_) {
        alert('Error processing wiremock file.')
        return
    }

    promptUserDownload(postmanCollection, collectionName)
}

function setDownloadState() {
    elements.download.disabled = !(uniqueRequestsByUrl && stubMappingsUrl)
}

async function handleUrlChange(event) {
    try {
        stubMappingsUrl = new URL(elements.urlInput.value)
        event.target.style.border = ''
    } catch (e) {
        stubMappingsUrl = null
        event.target.style.border = 'solid 1px red'
    } finally {
        setDownloadState()
    }
}

async function handleFileChange(event) {
    let wiremockStubMappingsFile
    try {
        wiremockStubMappingsFile = event.target.files.item(0)
        if (!wiremockStubMappingsFile) {
            event.target.value = ''
            uniqueRequestsByUrl = null
            return
        }

        let stubMappingsText = await wiremockStubMappingsFile.text()
        let stubMappingsJson = JSON.parse(stubMappingsText)
        uniqueRequestsByUrl = getRequestsByUniqueUrl(stubMappingsJson)
    } catch (e) {
        alert('Invalid file selected.')
        event.target.value = ''
        uniqueRequestsByUrl = null
        return
    } finally {
        setDownloadState()
    }

    if (uniqueRequestsByUrl && stubMappingsUrl) {
        createAndSavePostmanCollection(stubMappingsUrl, uniqueRequestsByUrl)
    }
}

const elements = {
    fileInput: document.getElementById('stub-mappings-input'),
    download: document.getElementById('stub-mappings-download'),
    urlInput: document.getElementById('stub-mappings-url')
}

let uniqueRequestsByUrl
let stubMappingsUrl

elements.fileInput.onchange = handleFileChange
elements.urlInput.oninput  = handleUrlChange
elements.download.onclick = () => {
    if (uniqueRequestsByUrl && stubMappingsUrl) {
        createAndSavePostmanCollection(stubMappingsUrl, uniqueRequestsByUrl)
    } else {
        alert('Must provide valid url & wiremock file.')
    }
}