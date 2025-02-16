/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./content.js":
/*!********************!*\
  !*** ./content.js ***!
  \********************/
/***/ (() => {

eval("chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {\n    if (message.type === 'conversation_clicked') {\n        const { contactName } = message;\n        console.log(`User clicked on conversation with: ${contactName}`);\n        // You can perform additional actions here, such as storing the data or sending it to an external API\n    }\n});\n\n\n//# sourceURL=webpack:///./content.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./content.js"]();
/******/ 	
/******/ })()
;