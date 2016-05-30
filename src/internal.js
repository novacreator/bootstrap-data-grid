// GRID INTERNAL FIELDS
// ====================

var namespace = ".rs.novacreator.bootstrap.datagrid";

// GRID INTERNAL FUNCTIONS
// =====================

function appendRow(row) {
    var that = this;
    function exists(item) {
        return that.identifier && item[that.identifier] === row[that.identifier];
    }

    if(!this.rows.contains(exists)) {
        this.rows.push(row);
        return true;
    }

    return false;
}

function findFooterAndHeaderItems(selector) {
    return $.merge((this.footer) ? this.footer.find(selector) : $(), (this.header) ? this.header.find(selector) : $());
}

function getParams(context) {
    return (context) ? $.extend({}, this.cachedParams, { ctx: context }) : this.cachedParams;
}

function getRequest() {
    var request = {
        current: this.current,
        rowCount: this.rowCount,
        sort: this.sortDictionary,
        searchPhrase: this.searchPhrase
    };
    var post = this.options.post;
    post = ($.isFunction(post)) ? post() : post;
    return this.options.requestHandler($.extend(true, request, post));
}

function getCssSelector(css) {
    return "." + $.trim(css).replace(/\s+/gm, ".");
}

function getUrl() {
    var url = this.options.url;
    return ($.isFunction(url)) ? url() : url;
}

function init() {
    this.element.trigger("initialize" + namespace);
    loadColumns.call(this); // Loads columns from HTML thead tag
    this.selection = this.options.selection && this.identifier != null;
    loadRows.call(this); // Loads rows from HTML tbody tag if ajax is false
    prepareTable.call(this);
    renderTableHeader.call(this);
    renderSearchField.call(this);
    renderActions.call(this);
    loadData.call(this);
    this.element.trigger("initialized" + namespace);
}

function highlightAppendedRows(rows) {
    if(this.options.highlightRows) {
        // todo: implement
    }
}

function isVisible(column) {
    return column.visible;
}

function loadColumns() {
    var that = this;
    var firstHeadRow = this.element.find("thead > tr").first();
    var sorted = false;

    /*jshint -W018*/
    firstHeadRow.children().each(function () {
        var $this = $(this);
        var data = $this.data();
        var column = {
            id: data.columnId,
            identifier: that.identifier == null && data.identifier || false,
            converter: that.options.converters[data.converter || data.type] || that.options.converters["string"],
            text: $this.text(),
            align: data.align || "left",
            headerAlign: data.headerAlign || "left",
            cssClass: data.cssClass || "",
            headerCssClass: data.headerCssClass || "",
            formatter: that.options.formatters[data.formatter] || null,
            order: (!sorted && (data.order === "asc" || data.order === "desc")) ? data.order : null,
            searchable: !(data.searchable === false), // default: true
            sortable: !(data.sortable === false), // default: true
            visible: !(data.visible === false), // default: true
            visibleInSelection: !(data.visibleInSelection === false), // default: true
            width: ($.isNumeric(data.width)) ? data.width + "px" : 
                (typeof(data.width) === "string") ? data.width : null
        };
        that.columns.push(column);
        if(column.order != null) {
            that.sortDictionary[column.id] = column.order;
        }

        // Prevents multiple identifiers
        if(column.identifier) {
            that.identifier = column.id;
            that.converter = column.converter;
        }

        // ensures that only the first order will be applied in case of multi sorting is disabled
        if(!that.options.multiSort && column.order !== null) {
            sorted = true;
        }
    });
    /*jshint +W018*/
}

function loadData() {
    var that = this;
    this.element._mcmBusyAria(true).trigger("load" + namespace);
    showLoading.call(this);

    function containsPhrase(row) {
        var column;
        var searchPattern = new RegExp(that.searchPhrase, (that.options.caseSensitive) ? "g" : "gi");
        for(var i = 0; i < that.columns.length; i++) {
            column = that.columns[i];
            if(column.searchable && column.visible && column.converter.to(row[column.id]).search(searchPattern) > -1) {
                return true;
            }
        }
        return false;
    }

    function update(rows, total) {
        that.currentRows = rows;
        setTotals.call(that, total);

        if(!that.options.keepSelection) {
            that.selectedRows = [];
        }

        renderRows.call(that, rows);
        renderInfos.call(that);
        renderPagination.call(that);

        that.element._mcmBusyAria(false).trigger("loaded" + namespace);
    }

    if(this.options.ajax) {
        var request = getRequest.call(this);
        var url = getUrl.call(this);

        if(url == null || typeof url !== "string" || url.length === 0) {
            throw new Error("Url setting must be a none empty string or a function that returns one.");
        }

        // aborts the previous ajax request if not already finished or failed
        if(this.xqr) {
            this.xqr.abort();
        }

        var settings = {
            url: url,
            data: request,
            success: function(response) {
                that.xqr = null;
                if(typeof (response) === "string") {
                    response = $.parseJSON(response);
                }

                response = that.options.responseHandler(response);
                that.current = response.current;
                update(response.rows, response.total);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                that.xqr = null;

                if(textStatus !== "abort") {
                    renderNoResultsRow.call(that); // overrides loading mask
                    that.element._mcmBusyAria(false).trigger("loaded" + namespace);
                }
            }
        };
        settings = $.extend(this.options.ajaxSettings, settings);
        this.xqr = $.ajax(settings);
    } else {
        var rows = (this.searchPhrase.length > 0) ? this.rows.where(containsPhrase) : this.rows;
        var total = rows.length;
        if(this.rowCount !== -1) {
            rows = rows.page(this.current, this.rowCount);
        }

        // todo: improve the following comment
        // setTimeout decouples the initialization so that adding event handlers happens before
        window.setTimeout(function () { update(rows, total); }, 10);
    }
}

function loadRows() {
    if(!this.options.ajax) {
        var that = this;
        var rows = this.element.find("tbody > tr");
        rows.each(function () {
            var $this = $(this);
            var cells = $this.children("td");
            var row = {};
            $.each(that.columns, function (i, column) {
                row[column.id] = column.converter.from(cells.eq(i).text());
            });
            appendRow.call(that, row);
        });

        setTotals.call(this, this.rows.length);
        sortRows.call(this);
    }
}

function setTotals(total) {
    this.total = total;
    this.totalPages = (this.rowCount === -1) ? 1 : Math.ceil(this.total / this.rowCount);
}

function prepareTable() {
    var tpl = this.options.templates;
    var wrapper = (this.element.parent().hasClass(this.options.css.responsiveTable)) ?
            this.element.parent() : this.element;
    this.element.addClass(this.options.css.table);

    // checks whether there is an tbody element; otherwise creates one
    if(this.element.children("tbody").length === 0) {
        this.element.append(tpl.body);
    }

    if(this.options.navigation & 1) {
        this.header = $(tpl.header.resolve(getParams.call(this, { id: this.element._mcmId() + "-header" })));
        wrapper.before(this.header);
    }

    if(this.options.navigation & 2) {
        this.footer = $(tpl.footer.resolve(getParams.call(this, { id: this.element._mcmId() + "-footer" })));
        wrapper.after(this.footer);
    }
}

function renderActions() {
    if(this.options.navigation !== 0) {
        var css = this.options.css;
        var selector = getCssSelector(css.actions);
        var actionItems = findFooterAndHeaderItems.call(this, selector);

        if(actionItems.length > 0) {
            var that = this;
            var tpl = this.options.templates;
            var actions = $(tpl.actions.resolve(getParams.call(this)));

            // Refresh Button
            if(this.options.ajax) {
                var refreshIcon = tpl.icon.resolve(getParams.call(this, { iconCss: css.iconRefresh }));
                var refresh = $(tpl.actionButton.resolve(getParams.call(this,
                    { content: refreshIcon, text: this.options.labels.refresh })))
                        .on("click" + namespace, function (e) {
                            // todo: prevent multiple fast clicks (fast click detection)
                            e.stopPropagation();
                            that.current = 1;
                            loadData.call(that);
                        });
                actions.append(refresh);
            }

            // Row count selection
            renderRowCountSelection.call(this, actions);

            // Column selection
            renderColumnSelection.call(this, actions);
            replacePlaceHolder.call(this, actionItems, actions);
        }
    }
}

function renderColumnSelection(actions) {
    if(this.options.columnSelection && this.columns.length > 1) {
        var that = this;
        var css = this.options.css;
        var tpl = this.options.templates;
        var icon = tpl.icon.resolve(getParams.call(this, { iconCss: css.iconColumns }));
        var dropDown = $(tpl.actionDropDown.resolve(getParams.call(this, { content: icon })));
        var selector = getCssSelector(css.dropDownItem);
        var checkboxSelector = getCssSelector(css.dropDownItemCheckbox);
        var itemsSelector = getCssSelector(css.dropDownMenuItems);

        $.each(this.columns, function(i, column) {
            if(column.visibleInSelection) {
                var item = $(tpl.actionDropDownCheckboxItem.resolve(getParams.call(that,
                    { name: column.id, label: column.text, checked: column.visible })))
                        .on("click" + namespace, selector, function (e) {
                            e.stopPropagation();
                            var $this = $(this);
                            var checkbox = $this.find(checkboxSelector);
                            if(!checkbox.prop("disabled")) {
                                column.visible = checkbox.prop("checked");
                                var enable = that.columns.where(isVisible).length > 1;
                                $this.parents(itemsSelector).find(selector + ":has(" + checkboxSelector + ":checked)")
                                    ._mcmEnableAria(enable).find(checkboxSelector)._mcmEnableField(enable);
    
                                that.element.find("tbody").empty(); // Fixes an column visualization bug
                                renderTableHeader.call(that);
                                loadData.call(that);
                            }
                        });
                dropDown.find(getCssSelector(css.dropDownMenuItems)).append(item);
            }
        });
        actions.append(dropDown);
    }
}

function renderInfos() {
    if(this.options.navigation !== 0) {
        var selector = getCssSelector(this.options.css.infos);
        var infoItems = findFooterAndHeaderItems.call(this, selector);

        if(infoItems.length > 0) {
            var end = (this.current * this.rowCount);
            var infos = $(this.options.templates.infos.resolve(getParams.call(this, {
                end: (this.total === 0 || end === -1 || end > this.total) ? this.total : end,
                start: (this.total === 0) ? 0 : (end - this.rowCount + 1),
                total: this.total
            })));

            replacePlaceHolder.call(this, infoItems, infos);
        }
    }
}

function renderNoResultsRow() {
    var tbody = this.element.children("tbody").first();
    var tpl = this.options.templates;
    var count = this.columns.where(isVisible).length;
    if(this.selection) {
        count++;
    }
    tbody.html(tpl.noResults.resolve(getParams.call(this, { columns: count })));
}

function renderPagination() {
    if(this.options.navigation !== 0) {
        var selector = getCssSelector(this.options.css.pagination);
        var paginationItems = findFooterAndHeaderItems.call(this, selector)._mcmShowAria(this.rowCount !== -1);

        if(this.rowCount !== -1 && paginationItems.length > 0) {
            var tpl = this.options.templates;
            var current = this.current;
            var totalPages = this.totalPages;
            var pagination = $(tpl.pagination.resolve(getParams.call(this)));
            var offsetRight = totalPages - current;
            var offsetLeft = (this.options.padding - current) * -1;
            var startWith = ((offsetRight >= this.options.padding) ?
                Math.max(offsetLeft, 1) :
                Math.max((offsetLeft - this.options.padding + offsetRight), 1));
            var maxCount = this.options.padding * 2 + 1;
            var count = (totalPages >= maxCount) ? maxCount : totalPages;

            renderPaginationItem.call(this, pagination, "first", "&laquo;", "first")._mcmEnableAria(current > 1);
            renderPaginationItem.call(this, pagination, "prev", "&lt;", "prev")._mcmEnableAria(current > 1);

            for(var i = 0; i < count; i++) {
                var pos = i + startWith;
                renderPaginationItem.call(this, pagination, pos, pos, "page-" + pos)._mcmEnableAria()._mcmSelectAria(pos === current);
            }

            if(count === 0) {
                renderPaginationItem.call(this, pagination, 1, 1, "page-" + 1)._mcmEnableAria(false)._mcmSelectAria();
            }

            renderPaginationItem.call(this, pagination, "next", "&gt;", "next")._mcmEnableAria(totalPages > current);
            renderPaginationItem.call(this, pagination, "last", "&raquo;", "last")._mcmEnableAria(totalPages > current);

            replacePlaceHolder.call(this, paginationItems, pagination);
        }
    }
}

function renderPaginationItem(list, page, text, markerCss) {
    var that = this;
    var tpl = this.options.templates;
    var css = this.options.css;
    var values = getParams.call(this, { css: markerCss, text: text, page: page });
    var item = $(tpl.paginationItem.resolve(values)).on("click" + namespace, getCssSelector(css.paginationButton), function (e) {
        e.stopPropagation();
        e.preventDefault();
        var $this = $(this);
        var parent = $this.parent();
        if(!parent.hasClass("active") && !parent.hasClass("disabled")) {
            var commandList = {
                first: 1,
                prev: that.current - 1,
                next: that.current + 1,
                last: that.totalPages
            };
            var command = $this.data("page");
            that.current = commandList[command] || command;
            loadData.call(that);
        }
        $this.trigger("blur");
    });

    list.append(item);
    return item;
}

function _getText(value, allLabels) {
    return (value === -1) ? allLabels : value;
}
function renderRowCountSelection(actions) {
    var that = this;
    var allLabels = that.options.labels.all;
    var rowCountList = this.options.rowCount;

    if($.isArray(rowCountList)) {
        var css = this.options.css;
        var tpl = this.options.templates;
        var dropDown = $(tpl.actionDropDown.resolve(getParams.call(this, { content: _getText(this.rowCount, allLabels) })));
        var menuSelector = getCssSelector(css.dropDownMenu);
        var menuTextSelector = getCssSelector(css.dropDownMenuText);
        var menuItemsSelector = getCssSelector(css.dropDownMenuItems);
        var menuItemSelector = getCssSelector(css.dropDownItemButton);

        $.each(rowCountList, function(index, value) {
            var item = $(tpl.actionDropDownItem.resolve(getParams.call(that,{ text: _getText(value, allLabels), action: value }))).
                _mcmSelectAria(value === that.rowCount).on("click" + namespace, menuItemSelector, function (e) {
                    e.preventDefault();
                    var $this = $(this);
                    var newRowCount = $this.data("action");
                    if(newRowCount !== that.rowCount) {
                        // todo: sophisticated solution needed for calculating which page is selected
                        that.current = 1; // that.rowCount === -1 ---> All
                        that.rowCount = newRowCount;
                        $this.parents(menuItemsSelector).children().each(function () {
                            var $item = $(this);
                            var currentRowCount = $item.find(menuItemSelector).data("action");
                            $item._mcmSelectAria(currentRowCount === newRowCount);
                        });
                        $this.parents(menuSelector).find(menuTextSelector).text(_getText(newRowCount, allLabels));
                        loadData.call(that);
                    }
                });
            dropDown.find(menuItemsSelector).append(item);
        });
        actions.append(dropDown);
    }
}

function renderRows(rows) {
    if(rows.length > 0) {
        var that = this;
        var css = this.options.css;
        var tpl = this.options.templates;
        var tbody = this.element.children("tbody").first();
        var allRowsSelected = true;
        var html = "";

        $.each(rows, function(index, row) {
            var cells = "";
            var rowAttr = " data-row-id=\"" + ((that.identifier == null) ? index : row[that.identifier]) + "\"";
            var rowCss = "";

            if(that.selection) {
                var selected = ($.inArray(row[that.identifier], that.selectedRows) !== -1);
                var selectBox = tpl.select.resolve(getParams.call(that,
                        { type: "checkbox", value: row[that.identifier], checked: selected }));
                cells += tpl.cell.resolve(getParams.call(that, { content: selectBox, css: css.selectCell }));
                allRowsSelected = (allRowsSelected && selected);
                if(selected) {
                    rowCss += css.selected;
                    rowAttr += " aria-selected=\"true\"";
                }
            }

            var status = row.status != null && that.options.statusMapping[row.status];
            if(status) {
                rowCss += status;
            }

            $.each(that.columns, function (j, column) {
                if(column.visible) {
                    var value = ($.isFunction(column.formatter)) ?
                        column.formatter.call(that, column, row) : column.converter.to(row[column.id]);
                    var cssClass = (column.cssClass.length > 0) ? " " + column.cssClass : "";
                    cells += tpl.cell.resolve(getParams.call(that, {
                        content: (value == null || value === "") ? "&nbsp;" : value,
                        css: ((column.align === "right") ? css.right : (column.align === "center") ?
                            css.center : css.left) + cssClass,
                        style: (column.width == null) ? "" : "width:" + column.width + ";" }));
                }
            });

            if(rowCss.length > 0) {
                rowAttr += " class=\"" + rowCss + "\"";
            }
            html += tpl.row.resolve(getParams.call(that, { attr: rowAttr, cells: cells }));
        });

        // sets or clears multi selectbox state
        that.element.find("thead " + getCssSelector(that.options.css.selectBox)).prop("checked", allRowsSelected);
        tbody.html(html);
        registerRowEvents.call(this, tbody);
    } else {
        renderNoResultsRow.call(this);
    }
}

function registerRowEvents(tbody) {
    var that = this;
    var selectBoxSelector = getCssSelector(this.options.css.selectBox);

    if(this.selection) {
        tbody.off("click" + namespace, selectBoxSelector).on("click" + namespace, selectBoxSelector, function(e) {
            e.stopPropagation();
            var $this = $(this);
            var id = that.converter.from($this.val());

            if($this.prop("checked")) {
                that.select([id]);
            } else {
                that.deselect([id]);
            }
        });
    }

    tbody.off("click" + namespace, "> tr").on("click" + namespace, "> tr", function(e) {
        e.stopPropagation();
        var $this = $(this);
        var id = (that.identifier == null) ? $this.data("row-id") : that.converter.from($this.data("row-id") + "");
        var row = (that.identifier == null) ? that.currentRows[id] :
            that.currentRows.first(function (item) { return item[that.identifier] === id; });
        if(that.selection && that.options.rowSelect) {
            if($this.hasClass(that.options.css.selected)) {
                that.deselect([id]);
            } else {
                that.select([id]);
            }
        }
        that.element.trigger("click" + namespace, [that.columns, row]);
    });
}

function renderSearchField() {
    if(this.options.navigation !== 0) {
        var css = this.options.css;
        var selector = getCssSelector(css.search);
        var searchItems = findFooterAndHeaderItems.call(this, selector);

        if(searchItems.length > 0) {
            var that = this;
            var tpl = this.options.templates;
            var timer = null; // fast keyup detection
            var currentValue = "";
            var searchFieldSelector = getCssSelector(css.searchField);
            var search = $(tpl.search.resolve(getParams.call(this)));
            var searchField = (search.is(searchFieldSelector)) ? search : search.find(searchFieldSelector);
            searchField.on("keyup" + namespace, function(e) {
                e.stopPropagation();
                var newValue = $(this).val();
                if(currentValue !== newValue || (e.which === 13 && newValue !== "")) {
                    currentValue = newValue;
                    if(e.which === 13 || newValue.length === 0 || newValue.length >= that.options.searchSettings.characters) {
                        window.clearTimeout(timer);
                        timer = window.setTimeout(function () {
                            executeSearch.call(that, newValue);
                        }, that.options.searchSettings.delay);
                    }
                }
            });

            replacePlaceHolder.call(this, searchItems, search);
        }
    }
}

function executeSearch(phrase) {
    if(this.searchPhrase !== phrase) {
        this.current = 1;
        this.searchPhrase = phrase;
        loadData.call(this);
    }
}

function renderTableHeader() {
    var that = this;
    var headerRow = this.element.find("thead > tr");
    var css = this.options.css;
    var tpl = this.options.templates;
    var html = "";
    var sorting = this.options.sorting;
    if(this.selection) {
        var selectBox = (this.options.multiSelect) ?
            tpl.select.resolve(getParams.call(that, { type: "checkbox", value: "all" })) : "";
        html += tpl.rawHeaderCell.resolve(getParams.call(that, { content: selectBox, css: css.selectCell }));
    }

    $.each(this.columns, function(index, column) {
        if(column.visible) {
            var sortOrder = that.sortDictionary[column.id];
            var iconCss = ((sorting && sortOrder && sortOrder === "asc") ? css.iconUp :
                    (sorting && sortOrder && sortOrder === "desc") ? css.iconDown : "");
            var icon = tpl.icon.resolve(getParams.call(that, { iconCss: iconCss }));
            var align = column.headerAlign;
            var cssClass = (column.headerCssClass.length > 0) ? " " + column.headerCssClass : "";
            html += tpl.headerCell.resolve(getParams.call(that, {
                column: column, icon: icon, sortable: sorting && column.sortable && css.sortable || "",
                css: ((align === "right") ? css.right : (align === "center") ? css.center : css.left) + cssClass,
                style: (column.width == null) ? "" : "width:" + column.width + ";" }));
            }
    });

    headerRow.html(html);

    if(sorting) {
        var sortingSelector = getCssSelector(css.sortable);
        headerRow.off("click" + namespace, sortingSelector).on("click" + namespace, sortingSelector, function(e) {
            e.preventDefault();
            setTableHeaderSortDirection.call(that, $(this));
            sortRows.call(that);
            loadData.call(that);
        });
    }

    // todo: create a own function for that piece of code
    if(this.selection && this.options.multiSelect) {
        var selectBoxSelector = getCssSelector(css.selectBox);
        headerRow.off("click" + namespace, selectBoxSelector).on("click" + namespace, selectBoxSelector, function(e) {
            e.stopPropagation();
            if($(this).prop("checked")) {
                that.select();
            } else {
                that.deselect();
            }
        });
    }
}

function setTableHeaderSortDirection(element) {
    var css = this.options.css;
    var iconSelector = getCssSelector(css.icon);
    var columnId = element.data("column-id") || element.parents("th").first().data("column-id");
    var sortOrder = this.sortDictionary[columnId];
    var icon = element.find(iconSelector);
    if(!this.options.multiSort) {
        element.parents("tr").first().find(iconSelector).removeClass(css.iconDown + " " + css.iconUp);
        this.sortDictionary = {};
    }
    if(sortOrder && sortOrder === "asc") {
        this.sortDictionary[columnId] = "desc";
        icon.removeClass(css.iconUp).addClass(css.iconDown);
    } else if(sortOrder && sortOrder === "desc") {
        if(this.options.multiSort) {
            var newSort = {};
            for(var key in this.sortDictionary) {
                if(key !== columnId) {
                    newSort[key] = this.sortDictionary[key];
                }
            }
            this.sortDictionary = newSort;
            icon.removeClass(css.iconDown);
        } else {
            this.sortDictionary[columnId] = "asc";
            icon.removeClass(css.iconDown).addClass(css.iconUp);
        }
    } else {
        this.sortDictionary[columnId] = "asc";
        icon.addClass(css.iconUp);
    }
}

function replacePlaceHolder(placeholder, element) {
    placeholder.each(function (index, item) {
        // todo: check how append is implemented. Perhaps cloning here is superfluous.
        $(item).before(element.clone(true)).remove();
    });
}

function showLoading() {
    var that = this;
    window.setTimeout(function() {
        if(that.element._mcmAria("busy") === "true") {
            var tpl = that.options.templates;
            var thead = that.element.children("thead").first();
            var tbody = that.element.children("tbody").first();
            var firstCell = tbody.find("tr > td").first();
            var padding = (that.element.height() - thead.height()) - (firstCell.height() + 20);
            var count = that.columns.where(isVisible).length;

            if(that.selection) {
                count = count + 1;
            }
            tbody.html(tpl.loading.resolve(getParams.call(that, { columns: count })));
            if(that.rowCount !== -1 && padding > 0) {
                tbody.find("tr > td").css("padding", "20px 0 " + padding + "px");
            }
        }
    }, 250);
}

function _sortOrder(order, value) {
    return (order === "asc") ? value : value * -1;
}
function sortRows() {
    var sortArray = [];

    function _sort(x, y, current) {
        current = current || 0;
        var next = current + 1;
        var item = sortArray[current];

        return (x[item.id] > y[item.id]) ? _sortOrder(item.order, 1) :
            (x[item.id] < y[item.id]) ? _sortOrder(item.order, -1) :
                (sortArray.length > next) ? _sort(x, y, next) : 0;
    }

    if(!this.options.ajax) {
        var that = this;
        for(var key in this.sortDictionary) {
            if(this.options.multiSort || sortArray.length === 0) {
                sortArray.push({
                    id: key,
                    order: this.sortDictionary[key]
                });
            }
        }

        if(sortArray.length > 0) {
            this.rows.sort(_sort);
        }
    }
}