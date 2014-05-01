

var trakt = require('./js/frontend/providers/trakttv');

var url = 'http://api3-tpb.rhcloud.com/torrents/?format=json';

// Hack to keep to cancel the request in case of new request
var currentRequest = null;

var Tpb = Backbone.Collection.extend({
    apiUrl: url,
    model: App.Model.Movie,

    initialize: function(models, options) {
        if (options.keywords) {
            this.apiUrl += '&keywords=' + options.keywords;
        }

        if (options.genre) {
            this.apiUrl += '&genre=' + options.genre;
        }

        if (options.page && options.page.match(/\d+/)) {
            this.apiUrl += '&page=' + options.page;
        }

        this.options = options;
        Tpb.__super__.initialize.apply(this, arguments);
    },

    fetch: function() {
        var collection = this;

        if(currentRequest) {
            currentRequest.abort();
        }

        currentRequest = request(this.apiUrl, {json: true}, function(err, res, tpbData) {
            var movies = [],
            memory = {};

            if (tpbData && tpbData.length === 0) {
                collection.set(movies);
                collection.trigger('loaded');
                return;
            }

            var imdbCodes = _.pluck(tpbData, 'imdb_id');
            var traktMovieCollection = new trakt.MovieCollection(imdbCodes);
            traktMovieCollection.getSummaries(function(trakData) {
                tpbData.forEach(function (movie) {
                    // No imdb, no movie.
		    movie.imdb_id = movie.imdb_id+''
                    if( typeof movie.imdb_id != 'string' || movie.imdb_id.replace('tt', '') == '' ){ return; }

                    var traktInfo = _.find(trakData, function(trakMovie) { return trakMovie.imdb_id == movie.imdb_id });
                    if(traktInfo) {
                        traktInfo.images.posterSmall = trakt.resizeImage(traktInfo.images.poster, '138');
                    } else {
                        traktInfo = {images:{}};
                    }

                    var torrents = {};
                    torrents[movie.quality || '720p'] = movie.torrent_link;

		    var year = movie.year || movie.title.match(/[^0-9]([0-9]{4})[^0-9]/) ? movie.title.match(/[^0-9]([0-9]{4})[^0-9]/)[1] : 9999;

                    // Temporary object
                    var movieModel = {
                        imdb:       movie.imdb_id,
                        title:      movie.title,
			year:       year,
                        runtime:    +traktInfo.runtime || 0,
                        synopsis:   traktInfo.overview || "",
                        voteAverage:parseFloat(movie.MovieRating),

                        image:      traktInfo.images.poster ? trakt.resizeImage(traktInfo.images.poster, '138') : '',
                        bigImage:   traktInfo.images.poster ? trakt.resizeImage(traktInfo.images.poster, '300') : '',
                        backdrop:   traktInfo.images.fanart,

                        quality:    movie.quality || '720p',
                        torrent:    movie.torrent_link ? 'http:'+movie.torrent_link : movie.magnet_link,
                        torrents:   torrents,
                        videos:     {},
                        subtitles:  {},
                        seeders:    movie.seeders,
                        leechers:   movie.leechers,

                        // YTS do not provide metadata and subtitle
                        hasMetadata:false,
                        hasSubtitle:false
                    };

                    var stored = memory[movieModel.imdb];

                    // Create it on memory map if it doesn't exist.
                    if (typeof stored === 'undefined') {
                        stored = memory[movieModel.imdb] = movieModel;
                    }

                    if (stored.quality !== movieModel.quality && movieModel.quality === '720p') {
                        stored.torrent = movieModel.torrent;
                        stored.quality = '720p';
                    }

                    // Set it's correspondent quality torrent URL.
                    stored.torrents[movie.quality || '720p'] = movie.torrent_link;

                    // Push it if not currently on array.
                    if (movies.indexOf(stored) === -1) {
                        movies.push(stored);
                    }
                });

                collection.set(movies);
                collection.trigger('loaded');
                console.log(movies);
                return;
            })
        })
    }
});

App.Scrapers.Tpb = Tpb;
