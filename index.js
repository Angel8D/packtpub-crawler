"use strict";
/*jshint esversion: 6 */
/* jshint node: true */

const Client = require( './client' );
const inquirer = require( 'inquirer' );
const argv = require( 'minimist' )( process.argv.slice( 2 ) );
const chalk = require( 'chalk' );
const ora = require( 'ora' );
const promises = [];
const questions = [];
const actionPromises = [];


if ( argv.help || argv.h ) {
	console.log( "Usage: packtpub-free --user=<packt username> --password=<packt password> --output=<output directory>" );
	console.log( "-u, --user      PACKT publishing username (Registration: https://www.packtpub.com/)" );
	console.log( "-p, --password  PACKT publishing password" );
	console.log( "-o, --output    Downloads directory" );
	process.exit( 0 );
}
if ( argv.user || argv.u ) {
	promises.push( Promise.resolve( { user: argv.user || argv.u } ) );
} else {
	questions.push( { type: 'input', name: 'user', message: 'PACKT USER', default: '' } );
}
if ( argv.password || argv.p ) {
	promises.push( Promise.resolve( { password: argv.password || argv.p } ) );
} else {
	questions.push( { type: 'password', name: 'password', message: 'PACKT PASSWORD', default: '' } );
}
questions.push( {
	type: 'checkbox',
	name: 'actions',
	message: 'Actions',
	choices: [ "Claim free ebook", "Update Library Info", "Download" ]
} );
questions.push( {
	type: 'rawlist',
	name: 'download',
	message: 'Download Options',
	choices: [ "First", "Not downloaded yet", "All" ],
	when: function( responses ) {
		return responses.actions.indexOf( "Download" ) >= 0;
	}
} );
questions.push( {
	type: 'input',
	name: 'output',
	message: 'Output directory',
	default: ( argv.output || argv.o || ( process.cwd() + "\\books" ) )
} );
if ( questions.length ) {
	promises.push( inquirer.prompt( questions ) );
}



let client = null;
let config = {};
let spinner = ora();
Promise.all( promises )
	.then( results => results.reduce( ( curr, next ) => Object.assign( curr, next ), {} ) )
	.then( credentials => {
		config = credentials;
		client = new Client( config );
		spinner.text = 'Authentication...';
		spinner.start();
		return client.login();
	} )
	.then( $ => {
		spinner.stop();
		if ( config.actions.indexOf( "Claim free ebook" ) >= 0 ) {
//			client.claimFreeBook();
		}
		if ( config.actions.indexOf( "Update Library Info" ) >= 0 ) {
			client.getLibraryInfo()
		}
		if ( config.actions.indexOf( "Download" ) >= 0 ) {
			client.getLibraryInfo().then(()=>{
				client.downloadBooks();
			});
		}
	} )
	.catch( err => {
		spinner.stop();
		console.error( chalk.bgRed.white( ` ${err.message} ` ) );
		process.exit( 1 );
	} );


spinner.text = 'Ejecutando acciones...';
spinner.start();
Promise.all( actionPromises )
	.then( result => {
		spinner.stop();
	} )
	.catch( err => {
		spinner.stop();
		console.error( chalk.bgRed.white( ` ${err.message} ` ) );
		process.exit( 1 );
	} );
