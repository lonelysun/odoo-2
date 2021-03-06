odoo.define('web_groupby_expand.group_expand', function (require) {
    var core = require('web.core');
    var QWeb = core.qweb;
    var _t = core._t;
    var ListView = require('web.ListView');
    var ViewManage = require('web.ViewManager')
    var formats = require('web.formats');
    var ControlPanel = require('web.ControlPanel');

    ListView.Groups.include({
        init: function (view, options) {
            this._super(view, options);
            this.groups_auto = [];
        },

        render: function (post_render) {
            var self = this;
            var $el = $('<tbody>');
            this.elements = [$el[0]];

            return this.datagroup.list(
                _(this.view.visible_columns).chain()
                    .filter(function (column) {
                        return column.tag === 'field';
                    })
                    .pluck('name').value(),
                function (groups) {
                    $el[0].appendChild(
                        self.render_groups(groups));
                    if (post_render) {
                        post_render();
                    }
                    if (self.options.expand) {
                        self.render_auto_groups(self.groups_auto);
                    }
                }, function (dataset) {
                    return self.render_dataset(dataset).then(function (list) {
                        self.children[null] = list;
                        self.elements =
                            [list.$current.replaceAll($el)[0]];
                        self.setup_resequence_rows(list, dataset);
                    }).always(function () {
                        if (post_render) {
                            post_render();
                        }
                        self.view.trigger('view_list_rendered');
                    });
                });
        },

        render_groups: function (datagroups) {
            var self = this;
            var placeholder = this.make_fragment();
            _(datagroups).each(function (group) {
                if (self.children[group.value]) {
                    self.records.proxy(group.value).reset();
                    delete self.children[group.value];
                }
                var child = self.children[group.value] = new (self.view.options.GroupsType)(self.view, {
                    records: self.records.proxy(group.value),
                    options: self.options,
                    columns: self.columns
                });
                self.bind_child_events(child);
                child.datagroup = group;

                var $row = child.$row = $('<tr class="o_group_header">');
                self.groups_auto.push([$row, child])
                if (group.openable && group.length) {
                    $row.click(function (e) {
                        if (!$row.data('open')) {
                            $row.data('open', true)
                                .find('span.ui-icon')
                                .removeClass('ui-icon-triangle-1-e')
                                .addClass('ui-icon-triangle-1-s');
                            child.open(self.point_insertion(e.currentTarget));
                        } else {
                            $row.removeData('open')
                                .find('span.ui-icon')
                                .removeClass('ui-icon-triangle-1-s')
                                .addClass('ui-icon-triangle-1-e');
                            child.close();
                            // force recompute the selection as closing group reset properties
                            var selection = self.get_selection();
                            $(self).trigger('selected', [selection.ids, this.records]);
                        }
                    });
                }
                placeholder.appendChild($row[0]);

                var $group_column = $('<th class="oe_list_group_name">').appendTo($row);
                // Don't fill this if group_by_no_leaf but no group_by
                if (group.grouped_on) {
                    var row_data = {};
                    row_data[group.grouped_on] = group;
                    var group_label = _t("Undefined");
                    var group_column = _(self.columns).detect(function (column) {
                        return column.id === group.grouped_on;
                    });
                    if (group_column) {
                        try {
                            group_label = group_column.format(row_data, {
                                value_if_empty: _t("Undefined"),
                                process_modifiers: false
                            });
                        } catch (e) {
                            group_label = _.str.escapeHTML(row_data[group_column.id].value);
                        }
                    } else {
                        group_label = group.value;
                        if (group_label instanceof Array) {
                            group_label = group_label[1];
                        }
                        if (group_label === false) {
                            group_label = _t('Undefined');
                        }
                        group_label = _.str.escapeHTML(group_label);
                    }

                    // group_label is html-clean (through format or explicit
                    // escaping if format failed), can inject straight into HTML
                    $group_column.html(_.str.sprintf(_t("%s (%d)"),
                        group_label, group.length));
                    if (group.length && group.openable) {
                        // Make openable if not terminal group & group_by_no_leaf
                        $group_column.prepend('<span class="ui-icon ui-icon-triangle-1-e" style="float: left;">');
                    } else {
                        // Kinda-ugly hack: jquery-ui has no "empty" icon, so set
                        // wonky background position to ensure nothing is displayed
                        // there but the rest of the behavior is ui-icon's
                        $group_column.prepend('<span class="ui-icon" style="float: left; background-position: 150px 150px">');
                    }
                }
                self.indent($group_column, group.level);

                if (self.options.selectable) {
                    $row.append('<td>');
                }
                _(self.columns).chain()
                    .filter(function (column) {
                        return column.invisible !== '1';
                    })
                    .each(function (column) {
                        if (column.meta) {
                            // do not do anything
                        } else if (column.id in group.aggregates) {
                            var r = {};
                            r[column.id] = {value: group.aggregates[column.id]};
                            $('<td class="oe_number">')
                                .html(column.format(r, {process_modifiers: false}))
                                .appendTo($row);
                        } else {
                            $row.append('<td>');
                        }
                    });
                if (self.options.deletable) {
                    $row.append('<td class="oe_list_group_pagination">');
                }
            });
            return placeholder;
        },

        render_auto_groups: function (groups_auto) {
            var self = this;
            if (!groups_auto) {
                groups_auto = self.groups_auto;
            }
            _.each(groups_auto, function (vals) {
                if (vals[1].datagroup.openable) {
                    if (!vals[0].data('open')) {
                        vals[0].data('open', true)
                            .find('span.ui-icon')
                            .removeClass('ui-icon-triangle-1-e')
                            .addClass('ui-icon-triangle-1-s');
                        vals[1].open(self.point_insertion(vals[0]));
                        $("#expand_icon").removeClass('fa-expand');
                        $("#expand_icon").addClass('fa-compress');
                    } else {
                        vals[0].removeData('open')
                            .find('span.ui-icon')
                            .removeClass('ui-icon-triangle-1-s')
                            .addClass('ui-icon-triangle-1-e');
                        vals[1].close();
                        $("#expand_icon").addClass('fa-expand');
                        $("#expand_icon").removeClass('fa-compress');
                    }
                }
            });
        },
    });

    ListView.include({
        init: function(parent, dataset, view_id, options) {
            this._super(parent, dataset, view_id, options);
            this.groups_auto = [];
        },
        load_list: function (arguments) {
            var self = this;
            result = this._super.apply(this, arguments);
            if (this.$buttons) {
                $('.o-list-expand').click(function () {
                    self.options.expand = true;
                    self.groups.render_auto_groups(false)
                })
            }

            $("#expand_icon").addClass('fa-expand');
            $("#expand_icon").removeClass('fa-compress');
            if (!this.grouped) {
                $('.o-list-expand').hide();
            }
            if (self.groups.datagroup.group_by == "") {
                $('.o-list-expand').hide();
            } else if (self.groups.datagroup.group_by == undefined) {
                $('.o-list-expand').hide();
                $(".oe_list_pager").hide();
            } else {
                $('.o-list-expand').show();
            }
            return result
        }
    });
});