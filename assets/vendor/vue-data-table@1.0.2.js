
var AbstractListComponent = function(extraData) {

    return {
        mounted: function() {
            this.refreshData();
        },
        props: {
            dataFetcher: Function,
            itemsPerPage: {
                type: Number,
                default: 10
            },
            threshold: {
                type: Number,
                default: 5
            },
            appendItems: {
                type: Boolean,
                default: true
            }
        },
        data: function() {
            return $.extend({}, {
                loading: false,
                items: [],
                totalCount: 0,
                currentPage: 0,
                hasNext: true,
                hasPrevious: false,
                firstItemIdx: 1,
                lastItemIdx: 5,
                scrollableElement: undefined,
                scrollableElementSelector: "",
                itemsSelector: "",
                sort: {
                    sortId: undefined,
                    ascending: true
                }
            }, extraData);
        },
        methods: {
            setupScrollListener: function() {
                var self = this;
                var $scrollableElement = self.findScrollableElement();

                $scrollableElement.on("scroll", function() {
                    self.onScroll();
                });
            },
            isSorted: function(column, ascending) {
                if (typeof ascending === "undefined") {
                    return !!column.sortId && column.sortId == this.sort.sortId;
                }
                return !!column.sortId && this.sort.sortId === column.sortId && this.sort.ascending === ascending;
            },
            changeSort: function(column) {
                if (!column.sortId) {
                    return;
                }
                if (this.sort.sortId === column.sortId) {
                    if (this.sort.ascending) {
                        this.onSort(column, false);
                    } else {
                        this.onSort(undefined);
                    }
                } else {
                    this.onSort(column, true);
                }
            },
            onSort: function(column, ascending) {
                if (!!column && this.isSorted(column, ascending)) {
                    this.sort.sortId = undefined;
                    this.sort.ascending = true;
                } else if (!!column) {
                    this.sort.sortId = column.sortId;
                    this.sort.ascending = ascending;
                } else {
                    this.sortId = undefined;
                    this.sort.ascending = true;
                }
                this.refreshData();
            },
            loadItems: function(pageNumber, extraOptions, callback) {
                var self = this;
                self.loading = true;

                var options = $.extend({"pageNumber": pageNumber, "sort": this.sort}, extraOptions);

                self.dataFetcher(options, function(response) {
                    if (!!callback) {
                        callback(response);
                    }
                    self.$emit('dataLoaded', response);
                    self.totalCount = response.count;
                    if (!self.appendItems) {
                        self.items = [];
                    }
                    for (var i = 0; i < response.results.length; i++) {
                        self.items.push(response.results[i]);
                    }
                    self.currentPage = pageNumber;
                    self.loading = false;
                    self.firstItemIdx = (self.currentPage - 1) * self.itemsPerPage + 1;
                    self.lastItemIdx = self.firstItemIdx + self.items.length - 1;
                    self.hasPrevious = !!response.previous;
                    self.hasNext = !!response.next;
                    setTimeout(function() {
                        self.setupScrollListener();
                    });
                });
            },
            findScrollableElement: function($element) {
                if (!!this.scrollableElement && this.scrollableElement.length > 0 && document.body.contains(this.scrollableElement[0])) {
                    return this.scrollableElement;
                }
                if (!$element) {
                    $element = $(this.$el).find(this.scrollableElementSelector);
                }

                if ($element.css('overflow-y') == 'scroll' || $element.css('overflow-y') == 'auto' || $element.css("overflow") == "auto") {
                    this.scrollableElement = $element;
                    return $element;
                } else {
                    var $parent = $element.parent();
                    if ($parent.length === 0) {
                        this.scrollableElement = $element;
                        return $element;
                    }
                    return this.findScrollableElement($element.parent());
                }

            },
            isScrolledIntoView: function (elem) {

                var scrollableElement = this.findScrollableElement();

                var tableWrapperTop = scrollableElement.offset().top;
                var tableWrapperBottom = tableWrapperTop + scrollableElement.height();

                var elemTop = $(elem).offset().top;
                var elemBottom = elemTop + $(elem).height();

                var isVisible = ((elemBottom <= tableWrapperBottom) && (elemBottom >= tableWrapperTop));
                return isVisible;
            },
            onScroll: function() {
                var rows = $(this.$el).find(this.itemsSelector);
                if (rows.length > this.threshold) {
                    var thresholdRow = rows[rows.length - this.threshold];
                    if(this.isScrolledIntoView(thresholdRow) && this.hasNext && !this.loading) {
                        this.onNextPage();
                    }
                }
            },
            refreshData: function(options) {
                var self = this;
                var page = 1;
                if (!!options && options.keepPage) {
                    page = this.currentPage;
                    delete options.keepPage;
                }
                this.loadItems(page, options, function () {
                    self.items.length = 0;
                });
            },
            onNextPage: function() {
                this.loadItems(this.currentPage + 1);
            },
            onPreviousPage: function() {
                this.loadItems(this.currentPage - 1);
            }
        }
    };
}

Vue.component('data-table-component', $.extend(true, {}, AbstractListComponent({
    scrollableElementSelector: ".table-wrapper",
    itemsSelector: "tbody tr"
}), {
    template: '' +
        '<div style="position: relative">' +
            '<div style="position: absolute; top: 15px; width: 100%; text-align: center;"  v-if="loading">' +
                '<pulse-loader :color="' + "'#49B1AF'" + '"></pulse-loader>' +
            '</div>' +

            '<div style="min-height: 50px;">' +
                '<div v-if="!!emptyText && items.length == 0 && !loading" style="display: flex; align-items: center; justify-content: center; height: 50px;" v-html="emptyText"></div>' +
                '<div class="table-wrapper" v-if="items.length > 0">' +
                    '<table style="width: 100%">' +
                        '<thead>' +
                            '<tr>' +
                                '<th v-for="column of tableSetup.columns" v-bind:style="{ width: column.width }" v-bind:class="{\'sortable\': !!column.sortId}">' +
                                    '<span v-on:click="changeSort(column)">{{ column.label }} ' +
                                        '<span v-if="isSorted(column)" class="icon" v-bind:class="{\'icon-arrow-up\': isSorted(column, true), \'icon-arrow-down\':isSorted(column, false)}"></span>' +
                                    '</span>' +
                                '</th>' +
                            '</tr>' +
                        '</thead>' +
                        '<tbody>' +
                            '<slot name="row" v-for="item in items" v-bind:item="item" v-bind:items="items"></slot>' +
                        '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
        '</div>',
    props: {
        tableSetup: Object,
        emptyText: String
    }
}));

Vue.component('data-list-component', $.extend(true, {}, AbstractListComponent({
    scrollableElementSelector: ".list-wrapper",
    itemsSelector: ".item-wrapper"
}), {
    template: '' +
        '<div style="position: relative">' +
            '<div style="position: absolute; top: 15px; width: 100%; text-align: center;"  v-if="loading">' +
                '<pulse-loader :color="' + "'#49B1AF'" + '"></pulse-loader>' +
            '</div>' +

            '<div style="min-height: 50px;">' +
                '<div class="list-wrapper" v-if="items.length > 0">' +
                    '<div class="item-wrapper" v-for="item of items">' +
                        '<component v-bind:key="item.id" v-bind:is="itemComponentDefinition" v-bind:item="item"></component>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>',
    props: {
        itemComponentDefinition: Object,
    }
}));

