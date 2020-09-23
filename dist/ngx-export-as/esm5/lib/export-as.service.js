import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
// import * as htmlDocx from 'html-docx-js/dist/html-docx';
import html2pdf from 'html2pdf.js';
import * as i0 from "@angular/core";
window['html2canvas'] = html2canvas;
var ExportAsService = /** @class */ (function () {
    function ExportAsService() {
    }
    /**
     * Main base64 get method, it will return the file as base64 string
     * @param config your config
     */
    ExportAsService.prototype.get = function (config) {
        // structure method name dynamically by type
        var func = 'get' + config.type.toUpperCase();
        // if type supported execute and return
        if (this[func]) {
            return this[func](config);
        }
        // throw error for unsupported formats
        return Observable.create(function (observer) { observer.error('Export type is not supported.'); });
    };
    /**
     * Save exported file in old javascript way
     * @param config your custom config
     * @param fileName Name of the file to be saved as
     */
    ExportAsService.prototype.save = function (config, fileName) {
        // set download
        config.download = true;
        // get file name with type
        config.fileName = fileName + '.' + config.type;
        return this.get(config);
    };
    /**
     * Converts content string to blob object
     * @param content string to be converted
     */
    ExportAsService.prototype.contentToBlob = function (content) {
        return Observable.create(function (observer) {
            // get content string and extract mime type
            var arr = content.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]);
            var n = bstr.length;
            var u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            observer.next(new Blob([u8arr], { type: mime }));
            observer.complete();
        });
    };
    /**
     * Removes base64 file type from a string like "data:text/csv;base64,"
     * @param fileContent the base64 string to remove the type from
     */
    ExportAsService.prototype.removeFileTypeFromBase64 = function (fileContent) {
        var re = /^data:[^]*;base64,/g;
        var newContent = re[Symbol.replace](fileContent, '');
        return newContent;
    };
    /**
     * Structure the base64 file content with the file type string
     * @param fileContent file content
     * @param fileMime file mime type "text/csv"
     */
    ExportAsService.prototype.addFileTypeToBase64 = function (fileContent, fileMime) {
        return "data:" + fileMime + ";base64," + fileContent;
    };
    /**
     * create downloadable file from dataURL
     * @param fileName downloadable file name
     * @param dataURL file content as dataURL
     */
    ExportAsService.prototype.downloadFromDataURL = function (fileName, dataURL) {
        var _this = this;
        // create blob
        this.contentToBlob(dataURL).subscribe(function (blob) {
            // download the blob
            _this.downloadFromBlob(blob, fileName);
        });
    };
    /**
     * Downloads the blob object as a file
     * @param blob file object as blob
     * @param fileName downloadable file name
     */
    ExportAsService.prototype.downloadFromBlob = function (blob, fileName) {
        // get object url
        var url = window.URL.createObjectURL(blob);
        // check for microsoft internet explorer
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            // use IE download or open if the user using IE
            window.navigator.msSaveOrOpenBlob(blob, fileName);
        }
        else {
            // if not using IE then create link element
            var element = document.createElement('a');
            // set download attr with file name
            element.setAttribute('download', fileName);
            // set the element as hidden
            element.style.display = 'none';
            // append the body
            document.body.appendChild(element);
            // set href attr
            element.href = url;
            // click on it to start downloading
            element.click();
            // remove the link from the dom
            document.body.removeChild(element);
        }
    };
    ExportAsService.prototype.getPDF = function (config) {
        var _this = this;
        return Observable.create(function (observer) {
            if (!config.options) {
                config.options = {};
            }
            config.options.filename = config.fileName;
            var element = document.getElementById(config.elementIdOrContent);
            var pdf = html2pdf().set(config.options).from(element ? element : config.elementIdOrContent);
            var download = config.download;
            var pdfCallbackFn = config.options.pdfCallbackFn;
            if (download) {
                if (pdfCallbackFn) {
                    _this.applyPdfCallbackFn(pdf, pdfCallbackFn).save();
                }
                else {
                    pdf.save();
                }
                observer.next();
                observer.complete();
            }
            else {
                if (pdfCallbackFn) {
                    _this.applyPdfCallbackFn(pdf, pdfCallbackFn).outputPdf('datauristring').then(function (data) {
                        observer.next(data);
                        observer.complete();
                    });
                }
                else {
                    pdf.outputPdf('datauristring').then(function (data) {
                        observer.next(data);
                        observer.complete();
                    });
                }
            }
        });
    };
    ExportAsService.prototype.applyPdfCallbackFn = function (pdf, pdfCallbackFn) {
        return pdf.toPdf().get('pdf').then(function (pdfRef) {
            pdfCallbackFn(pdfRef);
        });
    };
    ExportAsService.prototype.getPNG = function (config) {
        var _this = this;
        return Observable.create(function (observer) {
            var element = document.getElementById(config.elementIdOrContent);
            html2canvas(element, config.options).then(function (canvas) {
                var imgData = canvas.toDataURL('image/PNG');
                if (config.type === 'png' && config.download) {
                    _this.downloadFromDataURL(config.fileName, imgData);
                    observer.next();
                }
                else {
                    observer.next(imgData);
                }
                observer.complete();
            }, function (err) {
                observer.error(err);
            });
        });
    };
    ExportAsService.prototype.getCSV = function (config) {
        var _this = this;
        return Observable.create(function (observer) {
            var element = document.getElementById(config.elementIdOrContent);
            var csv = [];
            var rows = element.querySelectorAll('table tr');
            for (var index = 0; index < rows.length; index++) {
                var rowElement = rows[index];
                var row = [];
                var cols = rowElement.querySelectorAll('td, th');
                for (var colIndex = 0; colIndex < cols.length; colIndex++) {
                    var col = cols[colIndex];
                    row.push(col.innerText);
                }
                csv.push(row.join(','));
            }
            var csvContent = 'data:text/csv;base64,' + _this.btoa(csv.join('\n'));
            if (config.download) {
                _this.downloadFromDataURL(config.fileName, csvContent);
                observer.next();
            }
            else {
                observer.next(csvContent);
            }
            observer.complete();
        });
    };
    ExportAsService.prototype.getTXT = function (config) {
        var nameFrags = config.fileName.split('.');
        config.fileName = nameFrags[0] + ".txt";
        return this.getCSV(config);
    };
    ExportAsService.prototype.getXLS = function (config) {
        var _this = this;
        return Observable.create(function (observer) {
            var element = document.getElementById(config.elementIdOrContent);
            var ws3 = XLSX.utils.table_to_sheet(element, config.options);
            var wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws3, config.fileName);
            var out = XLSX.write(wb, { type: 'base64' });
            var xlsContent = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + out;
            if (config.download) {
                _this.downloadFromDataURL(config.fileName, xlsContent);
                observer.next();
            }
            else {
                observer.next(xlsContent);
            }
            observer.complete();
        });
    };
    ExportAsService.prototype.getXLSX = function (config) {
        return this.getXLS(config);
    };
    // private getDOCX(config: ExportAsConfig): Observable<string | null> {
    //   return Observable.create((observer) => {
    //     const contentDocument: string = document.getElementById(config.elementIdOrContent).outerHTML;
    //     const content = '<!DOCTYPE html>' + contentDocument;
    //     const converted = htmlDocx.asBlob(content, config.options);
    //     if (config.download) {
    //       this.downloadFromBlob(converted, config.fileName);
    //       observer.next();
    //       observer.complete();
    //     } else {
    //       const reader = new FileReader();
    //       reader.onloadend = () => {
    //         const base64data = reader.result;
    //         observer.next(base64data);
    //         observer.complete();
    //       };
    //       reader.readAsDataURL(converted);
    //     }
    //   });
    // }
    // private getDOC(config: ExportAsConfig): Observable<string | null> {
    //   return this.getDOCX(config);
    // }
    ExportAsService.prototype.getJSON = function (config) {
        var _this = this;
        return Observable.create(function (observer) {
            var data = []; // first row needs to be headers
            var headers = [];
            var table = document.getElementById(config.elementIdOrContent);
            for (var index = 0; index < table.rows[0].cells.length; index++) {
                headers[index] = table.rows[0].cells[index].innerHTML.toLowerCase().replace(/ /gi, '');
            }
            // go through cells
            for (var i = 1; i < table.rows.length; i++) {
                var tableRow = table.rows[i];
                var rowData = {};
                for (var j = 0; j < tableRow.cells.length; j++) {
                    rowData[headers[j]] = tableRow.cells[j].innerHTML;
                }
                data.push(rowData);
            }
            var jsonString = JSON.stringify(data);
            var jsonBase64 = _this.btoa(jsonString);
            var dataStr = 'data:text/json;base64,' + jsonBase64;
            if (config.download) {
                _this.downloadFromDataURL(config.fileName, dataStr);
                observer.next();
            }
            else {
                observer.next(data);
            }
            observer.complete();
        });
    };
    ExportAsService.prototype.getXML = function (config) {
        var _this = this;
        return Observable.create(function (observer) {
            var xml = '<?xml version="1.0" encoding="UTF-8"?><Root><Classes>';
            var tritem = document.getElementById(config.elementIdOrContent).getElementsByTagName('tr');
            for (var i = 0; i < tritem.length; i++) {
                var celldata = tritem[i];
                if (celldata.cells.length > 0) {
                    xml += '<Class name="' + celldata.cells[0].textContent + '">\n';
                    for (var m = 1; m < celldata.cells.length; ++m) {
                        xml += '\t<data>' + celldata.cells[m].textContent + '</data>\n';
                    }
                    xml += '</Class>\n';
                }
            }
            xml += '</Classes></Root>';
            var base64 = 'data:text/xml;base64,' + _this.btoa(xml);
            if (config.download) {
                _this.downloadFromDataURL(config.fileName, base64);
                observer.next();
            }
            else {
                observer.next(base64);
            }
            observer.complete();
        });
    };
    ExportAsService.prototype.btoa = function (content) {
        return btoa(unescape(encodeURIComponent(content)));
    };
    ExportAsService.ɵfac = function ExportAsService_Factory(t) { return new (t || ExportAsService)(); };
    ExportAsService.ɵprov = i0.ɵɵdefineInjectable({ token: ExportAsService, factory: ExportAsService.ɵfac });
    return ExportAsService;
}());
export { ExportAsService };
/*@__PURE__*/ (function () { i0.ɵsetClassMetadata(ExportAsService, [{
        type: Injectable
    }], function () { return []; }, null); })();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwb3J0LWFzLnNlcnZpY2UuanMiLCJzb3VyY2VSb290Ijoibmc6Ly9uZ3gtZXhwb3J0LWFzLyIsInNvdXJjZXMiOlsibGliL2V4cG9ydC1hcy5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDM0MsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUlsQyxPQUFPLFdBQVcsTUFBTSxhQUFhLENBQUM7QUFDdEMsT0FBTyxLQUFLLElBQUksTUFBTSxNQUFNLENBQUM7QUFDN0IsMkRBQTJEO0FBQzNELE9BQU8sUUFBUSxNQUFNLGFBQWEsQ0FBQzs7QUFFbkMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxHQUFHLFdBQVcsQ0FBQztBQUVwQztJQUdFO0lBQWdCLENBQUM7SUFFakI7OztPQUdHO0lBQ0gsNkJBQUcsR0FBSCxVQUFJLE1BQXNCO1FBQ3hCLDRDQUE0QztRQUM1QyxJQUFNLElBQUksR0FBRyxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUMvQyx1Q0FBdUM7UUFDdkMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDZCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUMzQjtRQUVELHNDQUFzQztRQUN0QyxPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUMsVUFBQyxRQUFRLElBQU8sUUFBUSxDQUFDLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL0YsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCw4QkFBSSxHQUFKLFVBQUssTUFBc0IsRUFBRSxRQUFnQjtRQUMzQyxlQUFlO1FBQ2YsTUFBTSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDdkIsMEJBQTBCO1FBQzFCLE1BQU0sQ0FBQyxRQUFRLEdBQUcsUUFBUSxHQUFHLEdBQUcsR0FB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LENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQztvQkFDaEUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO3dCQUM5QyxHQUFHLElBQUksVUFBVSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztxQkFDakU7b0JBQ0QsR0FBRyxJQUFJLFlBQVksQ0FBQztpQkFDckI7YUFDRjtZQUNELEdBQUcsSUFBSSxtQkFBbUIsQ0FBQztZQUMzQixJQUFNLE1BQU0sR0FBRyx1QkFBdUIsR0FBRyxLQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3hELElBQUksTUFBTSxDQUFDLFFBQVEsRUFBRTtnQkFDbkIsS0FBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQ2xELFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQzthQUNqQjtpQkFBTTtnQkFDTCxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3ZCO1lBQ0QsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3RCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLDhCQUFJLEdBQVosVUFBYSxPQUFlO1FBQzFCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQztrRkF0VFUsZUFBZTsyREFBZixlQUFlLFdBQWYsZUFBZTswQkFiNUI7Q0FxVUMsQUF6VEQsSUF5VEM7U0F4VFksZUFBZTtrREFBZixlQUFlO2NBRDNCLFVBQVUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzJztcclxuXHJcbmltcG9ydCB7IEV4cG9ydEFzQ29uZmlnIH0gZnJvbSAnLi9leHBvcnQtYXMtY29uZmlnLm1vZGVsJztcclxuXHJcbmltcG9ydCBodG1sMmNhbnZhcyBmcm9tICdodG1sMmNhbnZhcyc7XHJcbmltcG9ydCAqIGFzIFhMU1ggZnJvbSAneGxzeCc7XHJcbi8vIGltcG9ydCAqIGFzIGh0bWxEb2N4IGZyb20gJ2h0bWwtZG9jeC1qcy9kaXN0L2h0bWwtZG9jeCc7XHJcbmltcG9ydCBodG1sMnBkZiBmcm9tICdodG1sMnBkZi5qcyc7XHJcblxyXG53aW5kb3dbJ2h0bWwyY2FudmFzJ10gPSBodG1sMmNhbnZhcztcclxuXHJcbkBJbmplY3RhYmxlKClcclxuZXhwb3J0IGNsYXNzIEV4cG9ydEFzU2VydmljZSB7XHJcblxyXG4gIGNvbnN0cnVjdG9yKCkgeyB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE1haW4gYmFzZTY0IGdldCBtZXRob2QsIGl0IHdpbGwgcmV0dXJuIHRoZSBmaWxlIGFzIGJhc2U2NCBzdHJpbmdcclxuICAgKiBAcGFyYW0gY29uZmlnIHlvdXIgY29uZmlnXHJcbiAgICovXHJcbiAgZ2V0KGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIC8vIHN0cnVjdHVyZSBtZXRob2QgbmFtZSBkeW5hbWljYWxseSBieSB0eXBlXHJcbiAgICBjb25zdCBmdW5jID0gJ2dldCcgKyBjb25maWcudHlwZS50b1VwcGVyQ2FzZSgpO1xyXG4gICAgLy8gaWYgdHlwZSBzdXBwb3J0ZWQgZXhlY3V0ZSBhbmQgcmV0dXJuXHJcbiAgICBpZiAodGhpc1tmdW5jXSkge1xyXG4gICAgICByZXR1cm4gdGhpc1tmdW5jXShjb25maWcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIHRocm93IGVycm9yIGZvciB1bnN1cHBvcnRlZCBmb3JtYXRzXHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyKSA9PiB7IG9ic2VydmVyLmVycm9yKCdFeHBvcnQgdHlwZSBpcyBub3Qgc3VwcG9ydGVkLicpOyB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNhdmUgZXhwb3J0ZWQgZmlsZSBpbiBvbGQgamF2YXNjcmlwdCB3YXlcclxuICAgKiBAcGFyYW0gY29uZmlnIHlvdXIgY3VzdG9tIGNvbmZpZ1xyXG4gICAqIEBwYXJhbSBmaWxlTmFtZSBOYW1lIG9mIHRoZSBmaWxlIHRvIGJlIHNhdmVkIGFzXHJcbiAgICovXHJcbiAgc2F2ZShjb25maWc6IEV4cG9ydEFzQ29uZmlnLCBmaWxlTmFtZTogc3RyaW5nKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICAvLyBzZXQgZG93bmxvYWRcclxuICAgIGNvbmZpZy5kb3dubG9hZCA9IHRydWU7XHJcbiAgICAvLyBnZXQgZmlsZSBuYW1lIHdpdGggdHlwZVxyXG4gICAgY29uZmlnLmZpbGVOYW1lID0gZmlsZU5hbWUgKyAnLicgKyBjb25maWcudHlwZTtcclxuICAgIHJldHVybiB0aGlzLmdldChjb25maWcpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydHMgY29udGVudCBzdHJpbmcgdG8gYmxvYiBvYmplY3RcclxuICAgKiBAcGFyYW0gY29udGVudCBzdHJpbmcgdG8gYmUgY29udmVydGVkXHJcbiAgICovXHJcbiAgY29udGVudFRvQmxvYihjb250ZW50OiBzdHJpbmcpOiBPYnNlcnZhYmxlPEJsb2I+IHtcclxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXIpID0+IHtcclxuICAgICAgLy8gZ2V0IGNvbnRlbnQgc3RyaW5nIGFuZCBleHRyYWN0IG1pbWUgdHlwZVxyXG4gICAgICBjb25zdCBhcnIgPSBjb250ZW50LnNwbGl0KCcsJyksIG1pbWUgPSBhcnJbMF0ubWF0Y2goLzooLio/KTsvKVsxXSxcclxuICAgICAgICBic3RyID0gYXRvYihhcnJbMV0pO1xyXG4gICAgICBsZXQgbiA9IGJzdHIubGVuZ3RoO1xyXG4gICAgICBjb25zdCB1OGFyciA9IG5ldyBVaW50OEFycmF5KG4pO1xyXG4gICAgICB3aGlsZSAobi0tKSB7XHJcbiAgICAgICAgdThhcnJbbl0gPSBic3RyLmNoYXJDb2RlQXQobik7XHJcbiAgICAgIH1cclxuICAgICAgb2JzZXJ2ZXIubmV4dChuZXcgQmxvYihbdThhcnJdLCB7IHR5cGU6IG1pbWUgfSkpO1xyXG4gICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmVzIGJhc2U2NCBmaWxlIHR5cGUgZnJvbSBhIHN0cmluZyBsaWtlIFwiZGF0YTp0ZXh0L2NzdjtiYXNlNjQsXCJcclxuICAgKiBAcGFyYW0gZmlsZUNvbnRlbnQgdGhlIGJhc2U2NCBzdHJpbmcgdG8gcmVtb3ZlIHRoZSB0eXBlIGZyb21cclxuICAgKi9cclxuICByZW1vdmVGaWxlVHlwZUZyb21CYXNlNjQoZmlsZUNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCByZSA9IC9eZGF0YTpbXl0qO2Jhc2U2NCwvZztcclxuICAgIGNvbnN0IG5ld0NvbnRlbnQ6IHN0cmluZyA9IHJlW1N5bWJvbC5yZXBsYWNlXShmaWxlQ29udGVudCwgJycpO1xyXG4gICAgcmV0dXJuIG5ld0NvbnRlbnQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTdHJ1Y3R1cmUgdGhlIGJhc2U2NCBmaWxlIGNvbnRlbnQgd2l0aCB0aGUgZmlsZSB0eXBlIHN0cmluZ1xyXG4gICAqIEBwYXJhbSBmaWxlQ29udGVudCBmaWxlIGNvbnRlbnRcclxuICAgKiBAcGFyYW0gZmlsZU1pbWUgZmlsZSBtaW1lIHR5cGUgXCJ0ZXh0L2NzdlwiXHJcbiAgICovXHJcbiAgYWRkRmlsZVR5cGVUb0Jhc2U2NChmaWxlQ29udGVudDogc3RyaW5nLCBmaWxlTWltZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiBgZGF0YToke2ZpbGVNaW1lfTtiYXNlNjQsJHtmaWxlQ29udGVudH1gO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogY3JlYXRlIGRvd25sb2FkYWJsZSBmaWxlIGZyb20gZGF0YVVSTFxyXG4gICAqIEBwYXJhbSBmaWxlTmFtZSBkb3dubG9hZGFibGUgZmlsZSBuYW1lXHJcbiAgICogQHBhcmFtIGRhdGFVUkwgZmlsZSBjb250ZW50IGFzIGRhdGFVUkxcclxuICAgKi9cclxuICBkb3dubG9hZEZyb21EYXRhVVJMKGZpbGVOYW1lOiBzdHJpbmcsIGRhdGFVUkw6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgLy8gY3JlYXRlIGJsb2JcclxuICAgIHRoaXMuY29udGVudFRvQmxvYihkYXRhVVJMKS5zdWJzY3JpYmUoYmxvYiA9PiB7XHJcbiAgICAgIC8vIGRvd25sb2FkIHRoZSBibG9iXHJcbiAgICAgIHRoaXMuZG93bmxvYWRGcm9tQmxvYihibG9iLCBmaWxlTmFtZSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERvd25sb2FkcyB0aGUgYmxvYiBvYmplY3QgYXMgYSBmaWxlXHJcbiAgICogQHBhcmFtIGJsb2IgZmlsZSBvYmplY3QgYXMgYmxvYlxyXG4gICAqIEBwYXJhbSBmaWxlTmFtZSBkb3dubG9hZGFibGUgZmlsZSBuYW1lXHJcbiAgICovXHJcbiAgZG93bmxvYWRGcm9tQmxvYihibG9iOiBCbG9iLCBmaWxlTmFtZTogc3RyaW5nKSB7XHJcbiAgICAvLyBnZXQgb2JqZWN0IHVybFxyXG4gICAgY29uc3QgdXJsID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcbiAgICAvLyBjaGVjayBmb3IgbWljcm9zb2Z0IGludGVybmV0IGV4cGxvcmVyXHJcbiAgICBpZiAod2luZG93Lm5hdmlnYXRvciAmJiB3aW5kb3cubmF2aWdhdG9yLm1zU2F2ZU9yT3BlbkJsb2IpIHtcclxuICAgICAgLy8gdXNlIElFIGRvd25sb2FkIG9yIG9wZW4gaWYgdGhlIHVzZXIgdXNpbmcgSUVcclxuICAgICAgd2luZG93Lm5hdmlnYXRvci5tc1NhdmVPck9wZW5CbG9iKGJsb2IsIGZpbGVOYW1lKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIGlmIG5vdCB1c2luZyBJRSB0aGVuIGNyZWF0ZSBsaW5rIGVsZW1lbnRcclxuICAgICAgY29uc3QgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuICAgICAgLy8gc2V0IGRvd25sb2FkIGF0dHIgd2l0aCBmaWxlIG5hbWVcclxuICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2Rvd25sb2FkJywgZmlsZU5hbWUpO1xyXG4gICAgICAvLyBzZXQgdGhlIGVsZW1lbnQgYXMgaGlkZGVuXHJcbiAgICAgIGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgICAgLy8gYXBwZW5kIHRoZSBib2R5XHJcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XHJcbiAgICAgIC8vIHNldCBocmVmIGF0dHJcclxuICAgICAgZWxlbWVudC5ocmVmID0gdXJsO1xyXG4gICAgICAvLyBjbGljayBvbiBpdCB0byBzdGFydCBkb3dubG9hZGluZ1xyXG4gICAgICBlbGVtZW50LmNsaWNrKCk7XHJcbiAgICAgIC8vIHJlbW92ZSB0aGUgbGluayBmcm9tIHRoZSBkb21cclxuICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChlbGVtZW50KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UERGKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXIpID0+IHtcclxuICAgICAgaWYgKCFjb25maWcub3B0aW9ucykge1xyXG4gICAgICAgIGNvbmZpZy5vcHRpb25zID0ge307XHJcbiAgICAgIH1cclxuICAgICAgY29uZmlnLm9wdGlvbnMuZmlsZW5hbWUgPSBjb25maWcuZmlsZU5hbWU7XHJcbiAgICAgIGNvbnN0IGVsZW1lbnQ6IEhUTUxFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCk7XHJcbiAgICAgIGNvbnN0IHBkZiA9IGh0bWwycGRmKCkuc2V0KGNvbmZpZy5vcHRpb25zKS5mcm9tKGVsZW1lbnQgPyBlbGVtZW50IDogY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCk7XHJcblxyXG4gICAgICBjb25zdCBkb3dubG9hZCA9IGNvbmZpZy5kb3dubG9hZDtcclxuICAgICAgY29uc3QgcGRmQ2FsbGJhY2tGbiA9IGNvbmZpZy5vcHRpb25zLnBkZkNhbGxiYWNrRm47XHJcbiAgICAgIGlmIChkb3dubG9hZCkge1xyXG4gICAgICAgIGlmIChwZGZDYWxsYmFja0ZuKSB7XHJcbiAgICAgICAgICB0aGlzLmFwcGx5UGRmQ2FsbGJhY2tGbihwZGYsIHBkZkNhbGxiYWNrRm4pLnNhdmUoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcGRmLnNhdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKHBkZkNhbGxiYWNrRm4pIHtcclxuICAgICAgICAgIHRoaXMuYXBwbHlQZGZDYWxsYmFja0ZuKHBkZiwgcGRmQ2FsbGJhY2tGbikub3V0cHV0UGRmKCdkYXRhdXJpc3RyaW5nJykudGhlbihkYXRhID0+IHtcclxuICAgICAgICAgICAgb2JzZXJ2ZXIubmV4dChkYXRhKTtcclxuICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBwZGYub3V0cHV0UGRmKCdkYXRhdXJpc3RyaW5nJykudGhlbihkYXRhID0+IHtcclxuICAgICAgICAgICAgb2JzZXJ2ZXIubmV4dChkYXRhKTtcclxuICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFwcGx5UGRmQ2FsbGJhY2tGbihwZGYsIHBkZkNhbGxiYWNrRm4pIHtcclxuICAgIHJldHVybiBwZGYudG9QZGYoKS5nZXQoJ3BkZicpLnRoZW4oKHBkZlJlZikgPT4ge1xyXG4gICAgICBwZGZDYWxsYmFja0ZuKHBkZlJlZik7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UE5HKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXIpID0+IHtcclxuICAgICAgY29uc3QgZWxlbWVudDogSFRNTEVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcuZWxlbWVudElkT3JDb250ZW50KTtcclxuICAgICAgaHRtbDJjYW52YXMoZWxlbWVudCwgY29uZmlnLm9wdGlvbnMpLnRoZW4oKGNhbnZhcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IGltZ0RhdGEgPSBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS9QTkcnKTtcclxuICAgICAgICBpZiAoY29uZmlnLnR5cGUgPT09ICdwbmcnICYmIGNvbmZpZy5kb3dubG9hZCkge1xyXG4gICAgICAgICAgdGhpcy5kb3dubG9hZEZyb21EYXRhVVJMKGNvbmZpZy5maWxlTmFtZSwgaW1nRGF0YSk7XHJcbiAgICAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG9ic2VydmVyLm5leHQoaW1nRGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgIH0sIGVyciA9PiB7XHJcbiAgICAgICAgb2JzZXJ2ZXIuZXJyb3IoZXJyKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Q1NWKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXIpID0+IHtcclxuICAgICAgY29uc3QgZWxlbWVudDogSFRNTEVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcuZWxlbWVudElkT3JDb250ZW50KTtcclxuICAgICAgY29uc3QgY3N2ID0gW107XHJcbiAgICAgIGNvbnN0IHJvd3M6IGFueSA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbCgndGFibGUgdHInKTtcclxuICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHJvd3MubGVuZ3RoOyBpbmRleCsrKSB7XHJcbiAgICAgICAgY29uc3Qgcm93RWxlbWVudCA9IHJvd3NbaW5kZXhdO1xyXG4gICAgICAgIGNvbnN0IHJvdyA9IFtdO1xyXG4gICAgICAgIGNvbnN0IGNvbHMgPSByb3dFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RkLCB0aCcpO1xyXG4gICAgICAgIGZvciAobGV0IGNvbEluZGV4ID0gMDsgY29sSW5kZXggPCBjb2xzLmxlbmd0aDsgY29sSW5kZXgrKykge1xyXG4gICAgICAgICAgY29uc3QgY29sID0gY29sc1tjb2xJbmRleF07XHJcbiAgICAgICAgICByb3cucHVzaChjb2wuaW5uZXJUZXh0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY3N2LnB1c2gocm93LmpvaW4oJywnKSk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgY3N2Q29udGVudCA9ICdkYXRhOnRleHQvY3N2O2Jhc2U2NCwnICsgdGhpcy5idG9hKGNzdi5qb2luKCdcXG4nKSk7XHJcbiAgICAgIGlmIChjb25maWcuZG93bmxvYWQpIHtcclxuICAgICAgICB0aGlzLmRvd25sb2FkRnJvbURhdGFVUkwoY29uZmlnLmZpbGVOYW1lLCBjc3ZDb250ZW50KTtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dChjc3ZDb250ZW50KTtcclxuICAgICAgfVxyXG4gICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFRYVChjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICBjb25zdCBuYW1lRnJhZ3MgPSBjb25maWcuZmlsZU5hbWUuc3BsaXQoJy4nKTtcclxuICAgIGNvbmZpZy5maWxlTmFtZSA9IGAke25hbWVGcmFnc1swXX0udHh0YDtcclxuICAgIHJldHVybiB0aGlzLmdldENTVihjb25maWcpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRYTFMoY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcikgPT4ge1xyXG5cclxuICAgICAgY29uc3QgZWxlbWVudDogSFRNTEVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcuZWxlbWVudElkT3JDb250ZW50KTtcclxuICAgICAgY29uc3Qgd3MzID0gWExTWC51dGlscy50YWJsZV90b19zaGVldChlbGVtZW50LCBjb25maWcub3B0aW9ucyk7XHJcbiAgICAgIGNvbnN0IHdiID0gWExTWC51dGlscy5ib29rX25ldygpO1xyXG4gICAgICBYTFNYLnV0aWxzLmJvb2tfYXBwZW5kX3NoZWV0KHdiLCB3czMsIGNvbmZpZy5maWxlTmFtZSk7XHJcbiAgICAgIGNvbnN0IG91dCA9IFhMU1gud3JpdGUod2IsIHsgdHlwZTogJ2Jhc2U2NCcgfSk7XHJcbiAgICAgIGNvbnN0IHhsc0NvbnRlbnQgPSAnZGF0YTphcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGVldDtiYXNlNjQsJyArIG91dDtcclxuICAgICAgaWYgKGNvbmZpZy5kb3dubG9hZCkge1xyXG4gICAgICAgIHRoaXMuZG93bmxvYWRGcm9tRGF0YVVSTChjb25maWcuZmlsZU5hbWUsIHhsc0NvbnRlbnQpO1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KHhsc0NvbnRlbnQpO1xyXG4gICAgICB9XHJcbiAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0WExTWChjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRYTFMoY29uZmlnKTtcclxuICB9XHJcblxyXG4gIC8vIHByaXZhdGUgZ2V0RE9DWChjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgLy8gICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgLy8gICAgIGNvbnN0IGNvbnRlbnREb2N1bWVudDogc3RyaW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCkub3V0ZXJIVE1MO1xyXG4gIC8vICAgICBjb25zdCBjb250ZW50ID0gJzwhRE9DVFlQRSBodG1sPicgKyBjb250ZW50RG9jdW1lbnQ7XHJcbiAgLy8gICAgIGNvbnN0IGNvbnZlcnRlZCA9IGh0bWxEb2N4LmFzQmxvYihjb250ZW50LCBjb25maWcub3B0aW9ucyk7XHJcbiAgLy8gICAgIGlmIChjb25maWcuZG93bmxvYWQpIHtcclxuICAvLyAgICAgICB0aGlzLmRvd25sb2FkRnJvbUJsb2IoY29udmVydGVkLCBjb25maWcuZmlsZU5hbWUpO1xyXG4gIC8vICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAvLyAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gIC8vICAgICB9IGVsc2Uge1xyXG4gIC8vICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcbiAgLy8gICAgICAgcmVhZGVyLm9ubG9hZGVuZCA9ICgpID0+IHtcclxuICAvLyAgICAgICAgIGNvbnN0IGJhc2U2NGRhdGEgPSByZWFkZXIucmVzdWx0O1xyXG4gIC8vICAgICAgICAgb2JzZXJ2ZXIubmV4dChiYXNlNjRkYXRhKTtcclxuICAvLyAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgLy8gICAgICAgfTtcclxuICAvLyAgICAgICByZWFkZXIucmVhZEFzRGF0YVVSTChjb252ZXJ0ZWQpO1xyXG4gIC8vICAgICB9XHJcbiAgLy8gICB9KTtcclxuICAvLyB9XHJcblxyXG4gIC8vIHByaXZhdGUgZ2V0RE9DKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAvLyAgIHJldHVybiB0aGlzLmdldERPQ1goY29uZmlnKTtcclxuICAvLyB9XHJcblxyXG4gIHByaXZhdGUgZ2V0SlNPTihjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxhbnlbXSB8IG51bGw+IHtcclxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXIpID0+IHtcclxuICAgICAgY29uc3QgZGF0YSA9IFtdOyAvLyBmaXJzdCByb3cgbmVlZHMgdG8gYmUgaGVhZGVyc1xyXG4gICAgICBjb25zdCBoZWFkZXJzID0gW107XHJcbiAgICAgIGNvbnN0IHRhYmxlID0gPEhUTUxUYWJsZUVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCk7XHJcbiAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0YWJsZS5yb3dzWzBdLmNlbGxzLmxlbmd0aDsgaW5kZXgrKykge1xyXG4gICAgICAgIGhlYWRlcnNbaW5kZXhdID0gdGFibGUucm93c1swXS5jZWxsc1tpbmRleF0uaW5uZXJIVE1MLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvIC9naSwgJycpO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGdvIHRocm91Z2ggY2VsbHNcclxuICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCB0YWJsZS5yb3dzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgY29uc3QgdGFibGVSb3cgPSB0YWJsZS5yb3dzW2ldOyBjb25zdCByb3dEYXRhID0ge307XHJcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0YWJsZVJvdy5jZWxscy5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgcm93RGF0YVtoZWFkZXJzW2pdXSA9IHRhYmxlUm93LmNlbGxzW2pdLmlubmVySFRNTDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZGF0YS5wdXNoKHJvd0RhdGEpO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IGpzb25TdHJpbmcgPSBKU09OLnN0cmluZ2lmeShkYXRhKTtcclxuICAgICAgY29uc3QganNvbkJhc2U2NCA9IHRoaXMuYnRvYShqc29uU3RyaW5nKTtcclxuICAgICAgY29uc3QgZGF0YVN0ciA9ICdkYXRhOnRleHQvanNvbjtiYXNlNjQsJyArIGpzb25CYXNlNjQ7XHJcbiAgICAgIGlmIChjb25maWcuZG93bmxvYWQpIHtcclxuICAgICAgICB0aGlzLmRvd25sb2FkRnJvbURhdGFVUkwoY29uZmlnLmZpbGVOYW1lLCBkYXRhU3RyKTtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dChkYXRhKTtcclxuICAgICAgfVxyXG4gICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFhNTChjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIGxldCB4bWwgPSAnPD94bWwgdmVyc2lvbj1cIjEuMFwiIGVuY29kaW5nPVwiVVRGLThcIj8+PFJvb3Q+PENsYXNzZXM+JztcclxuICAgICAgY29uc3QgdHJpdGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCkuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3RyJyk7XHJcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJpdGVtLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgY29uc3QgY2VsbGRhdGEgPSB0cml0ZW1baV07XHJcbiAgICAgICAgaWYgKGNlbGxkYXRhLmNlbGxzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHhtbCArPSAnPENsYXNzIG5hbWU9XCInICsgY2VsbGRhdGEuY2VsbHNbMF0udGV4dENvbnRlbnQgKyAnXCI+XFxuJztcclxuICAgICAgICAgIGZvciAobGV0IG0gPSAxOyBtIDwgY2VsbGRhdGEuY2VsbHMubGVuZ3RoOyArK20pIHtcclxuICAgICAgICAgICAgeG1sICs9ICdcXHQ8ZGF0YT4nICsgY2VsbGRhdGEuY2VsbHNbbV0udGV4dENvbnRlbnQgKyAnPC9kYXRhPlxcbic7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICB4bWwgKz0gJzwvQ2xhc3M+XFxuJztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgeG1sICs9ICc8L0NsYXNzZXM+PC9Sb290Pic7XHJcbiAgICAgIGNvbnN0IGJhc2U2NCA9ICdkYXRhOnRleHQveG1sO2Jhc2U2NCwnICsgdGhpcy5idG9hKHhtbCk7XHJcbiAgICAgIGlmIChjb25maWcuZG93bmxvYWQpIHtcclxuICAgICAgICB0aGlzLmRvd25sb2FkRnJvbURhdGFVUkwoY29uZmlnLmZpbGVOYW1lLCBiYXNlNjQpO1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KGJhc2U2NCk7XHJcbiAgICAgIH1cclxuICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidG9hKGNvbnRlbnQ6IHN0cmluZykge1xyXG4gICAgcmV0dXJuIGJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KGNvbnRlbnQpKSk7XHJcbiAgfVxyXG5cclxufVxyXG4iXX0=