module.exports = {
    POST: ({url, body}) => {
        if(typeof body !== 'object'){
            throw "request body not parsed"
        }
        return {...body, responseMessage:"I think we're parked man", query: url.query}
    }
}