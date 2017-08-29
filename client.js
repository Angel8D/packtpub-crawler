"use strict";
/*jshint esversion: 6 */
/* jshint node: true */

const chalk = require( 'chalk' );
const request = require( 'request' );
const cheerio = require( 'cheerio' );
const EventEmitter = require( 'events' );
const rp = require( 'request-promise' );
const debug = require( 'debug' )( 'client' );
const eol = require('os').EOL;
const fs = require( 'fs' );
const readline = require('readline');
const _ = require('lodash');

class Client extends EventEmitter {

	constructor( config ) {
		super();
		config = config || {};
		this.config = config;
		this.baseUrl = 'https://www.packtpub.com';
		this.jar = request.jar();
	}
	_request( uri, method, data, options ) {
		method = method || 'get';
		data = data || {};
		options = options || {};

		if ( uri.indexOf( this.baseUrl ) !== 0 ) {
			uri = `${this.baseUrl}${uri}`;
		}
		const _options = Object.assign( {
			uri,
			jar: this.jar,
			transform: ( body ) => cheerio.load( body )
		}, options );

		if ( 'post' === method.toLowerCase() ) {
			_options.method = 'post';
			_options.form = data;
		}

		debug( 'request', _options );
		return rp( _options );
	}
	_mkDir( path ) {
		try {
			fs.mkdirSync( path );
		} catch ( e ) {
			if ( e.code != 'EEXIST' ) throw e;
		}
	}



	login() {
		console.error( '-- Login' );
		return this._request( '' )
			.then( $ => {
				const $form = $( '#packt-user-login-form' );
				const data = $form
					.serializeArray()
					.reduce( ( prev, curr ) => Object.assign( prev, {
						[ curr.name ]: curr.value
					} ), {} );

				data.email = this.config.user;
				data.password = this.config.password;
				data.op = 'Login';

				return this._request( '', $form.attr( 'method' ), data, {
					resolveWithFullResponse: true,
					transform: null,
					followRedirect: false
				} );
			} )
			.then( () => {
				throw new Error( "Couldn't login!" );
			} )
			.catch( e => {
				if ( e.response && e.response.headers && e.response.headers.location ) {
					return this._request( e.response.headers.location );
				}
				throw e;
			} );
	}
	claimFreeBook() {
		console.error( '-- Claim Book' );
		return this._request( '/packt/offers/free-learning' )
			.then( $ => {
				return this._request( $( '.free-ebook a.twelve-days-claim' )
					.attr( 'href' ) );
			} );
	}
	getLibraryInfo( outputPath ) {
		console.error( '-- Get Library Info' );
		var path = outputPath || this.config.output;
		var baseUrl = this.baseUrl;
		return this._request( '/account/my-ebooks' )
			.then( $ => {
				const $bookList = $( '#product-account-list .product-line' );
				const $books = [];
				$bookList.each( function( index, book ) {
					let b = $( book );
					let t = b.find( '.product-thumbnail a' ).first();
					let c = b.find( '.product-thumbnail img.imagecache-thumbview' ).first();
					let nid =  b.attr( 'nid' );
					if (nid) {
						console.error( 'Libro '+ nid + " - " + b.attr( 'title' ) + " - " + t.attr( 'href' ));
						var object = {
							nid:
								nid,
							title:
								c.attr( 'title' ),
							image:
								c.attr( 'src' ),
							page:
								t.attr( 'href' ),
							pdf: baseUrl +
								b.find( '.fake-button[format="pdf"]' ).parent().attr( 'href' ),
							epub: baseUrl +
								b.find( '.fake-button[format="epub"]' ).parent().attr( 'href' ),
							code: baseUrl + '/code_download/' + nid
						};
						$books.push(object);
					}
				} );
				this._mkDir( path );
				fs.open( path + '/books.js', 'w+', ( err, fd ) => {
					fs.write(fd, JSON.stringify($books));
				});
				return $books;
			} );
	}
	downloadBooks(outputPath){
		console.error( '-- Download Books' );
		var path = outputPath || this.config.output;
		fs.readFile( path + '/books.js',  'utf8', ( err, data ) => {
			var books = JSON.parse(data);
			if (this.config.download == "First" && books && books.length > 0) {
				books = [books[0]];
			}
			if (this.config.download == "Not downloaded yet" && books && books.length > 0) {
				var downloaded = [];
				var reader = readline.createInterface({
					input: fs.createReadStream(path + '/downloaded.txt'),
					output: process.stdout,
					console: false
				})
				reader.on('line', function(line) {
					downloaded.push({nid:line});
				});
				var self = this;
				reader.on('close', function() {
					books = _.differenceBy(books, downloaded,'nid');
					books = books.slice(0, 5);
					self.download(books, path)
				});
			}
			if (this.config.download == "All" && books && books.length > 0) {
				books = books.slice(0, 5);
				this.download(books, path)
			}
		});
	}



	download( books, path ) {
		const urls = [];
		books.forEach(book => {
			var nameParts = book.page.split("/");
			var category = nameParts[1];
			var name = nameParts[nameParts.length-1];
			this._mkDir( path + '\\' + category  );
			urls.push({
				name: path + '\\' + category + '\\' + book.nid + "-" + name + '.pdf',
				url : book.pdf,
				nid : book.nid
			});
		});


		return Promise.all(
			urls.map( url => new Promise( ( resolve, reject ) => {
				const downloadRequest = request( {
					url: url.url,
					jar: this.jar
				} );
				console.log('URL: '+JSON.stringify(url));
				downloadRequest.pipe( fs.createWriteStream( url.name ) );
				downloadRequest.on( 'end', () => {
					fs.appendFile( path + '/downloaded.txt', url.nid + eol );
				});
			}))
		);
	}
}

module.exports = Client;
