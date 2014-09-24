Users = Meteor.users;
TimeEntries = new Meteor.Collection('entries');

Users.allow({
  update: function () {return true;}
});

if (Meteor.isClient) {

  Template.NavBar.events({
    'click .btn-show-timesheet': function () {
      Session.set('reportCategory', null);
      $('.modal').modal();
    }
  });

  var currentTimeEntry = function () {
    return TimeEntries.findOne({
      _finished: {
        $exists: false
      }
    });    
  };

  var clockIn = function (categories) {
    var entry = currentTimeEntry();
    if (entry) {
      clockOut(entry);
    }
    entry = {
      userId: Meteor.userId()
      , start: new Date()
      , categories: categories
      , tick: new Date()
    };
    TimeEntries.insert(entry);
    // Session.set('selectedJob', categories);
  };

  var clockOut = function (entry) {
    entry = entry || currentTimeEntry();
    if (entry) {
      var end = new Date();
      var duration = end - entry.start;
      TimeEntries.update(entry._id, {
        $set: {
          end: end
          , duration: duration
          , _finished: true
        }
      });
    }
  };

  Template.clockoutButton.helpers({
    clockedIn: function () {
      var entry = currentTimeEntry();
      if (this.path) {
        var selectedCategories = entry && entry.categories;
        return selectedCategories && _.contains(selectedCategories, _.last(this.path));
      } else {
        return !!entry;
      }
    }
  });

  Template.clockoutButton.events({
    'click .btn-clockOut': function () {
      clockOut();
    }
    , 'click .btn-clockIn': function () {
      clockIn(this.path);
    }
  });

  var userSchema = new Schema({
    name: 'user'
    , schema: {
      _id: []
      , profile: {
        categories: {
          isArray: true
          , schema: {
            _id: []
            , name: []
          }
        }
      }
    }
  });

  var timer = new Deps.Dependency();

  // Invalidate timer every 15 seconds
  Meteor.setInterval(function () {
    timer.changed();
  }, /*15 * */1000);

  userSchema.schema.profile.schema.categories.schema.categories = userSchema.schema.profile.schema.categories;

  Template.App.helpers({
    user: function () {
      return new ShadowObject(userSchema, Meteor.user());
    }
  });

  Template.CategoryRows.helpers({
    // it's nice having the currently selected item at the top,
    // but it needs some animation or it drives the user batty.

    // categories: function () {
    //   var selectedCategories = Session.get('selectedCategories');
    //   return _.sortBy(this.categories.concat(), function (a) {
    //     return (selectedCategories && _.contains(selectedCategories, a._id)) ? -1 : 1;
    //   });
    // }
  });

  var getPath = function (parent) {
      var path = [];
      while (parent._id) {
        path.unshift(parent._id);
        parent = parent._.parent._.parent;
      }
      return path;
  };

  var formatHours = function (duration) {
    var hours = Math.floor(duration.asHours());
    var minutes = duration.minutes();
    return hours + ":" + minutes + ":" + duration.seconds();
  };

  var getHours = function (category) {

      var hasStart = !!Session.get('start');
      var hasEnd = !!Session.get('end');

      if (!hasEnd) timer.depend();

      var start = moment(Session.get('start') || new Date(0));
      var end = moment(Session.get('end') || new Date()).endOf('day');

      var query = {};

      if (category) {
        query.categories = category;
      }

      var entries = TimeEntries.find(query).fetch();

      // the end of the fifteenth
      var theFifteenth = end.clone().startOf('month').add(16, 'days');

      var processTimeSpan = function (a) {
        var time = _.reduce(entries, function (memo, entry) {
          if (!entry.start) return memo;
          var start = moment(entry.start).min(a.start).max(a.end);
          var end = moment(entry.end || new Date()).min(a.start).max(a.end);
          return memo + end - start;
        }, 0);

        if (!time) {
          a.time = "-";
        } else if (a.average) {
          a.time = formatHours(moment.duration(time / start.diff(end, a.average, true)));
        } else {
          a.time = formatHours(moment.duration(time));
        }

        return a;
      };

      var todaySpans = [
        {
          name: 'Day'
          , start: end.clone().startOf('day')
          , end: end.clone().endOf('day')
        }
        , {
          name: 'Week'
          , start: end.clone().startOf('week')
          , end: end.clone().endOf('week')
        }
        , {
          name: 'Semi-Month'
          , start: end.date() > 15 ? theFifteenth : end.clone().startOf('month')
          , end: end.date() > 15 ? end.clone().endOf('month') : theFifteenth
        }
        , {
          name: 'Month'
          , start: end.clone().startOf('month')
          , end: end.clone().endOf('month')
        }
        , { 
          name: 'Total'
          , start: start
          , end: end
        }
      ];

      var averageSpans = [
        {
          name: 'Hours'
          , start: start
          , end: end
        }
        , {
          name: 'per Day'
          , start: start
          , end: end
          , average: 'day'
        }
        , {
          name: 'per Week'
          , start: start
          , end: end
          , average: 'week'
        }
        , {
          name: 'per Month'
          , start: start
          , end: end
          , average: 'month'
        }
      ];

      if (!hasStart) {
        return _.map(todaySpans, processTimeSpan);
      } else {
        return _.map(averageSpans, processTimeSpan);
      }
  };

  Template.TimeSheet.events({
    'click tr.categoryRow': function () {
      var path = getPath(this);
      Session.set('selectedCategories', path);
    }
    , 'click .btn-add-category': function () {
      var name = prompt('Category Name');
      if (name) {
        this.categories.push({
          _id: Random.id()
          , name: name
          , categories: []
        });
      }
    }
    , 'click .btn-edit-category': function () {
      var name = prompt('Category Name');
      if (name) {
        this.name = name;
      }
    }
    , 'click .btn-remove-category': function () {
      var remove = confirm('Are you sure you want to remove this category?');
      if (remove) {
        var categories = this._.parent;
        var index = categories.indexOf(this);
        categories.splice(index, 1);
      }
    }
  });

  Template.TimeSheet.helpers({
    timeSpans: function () {
      return getHours();
    }
    , autosave: function () {
      var val = this._();
      if(val) Users.update(val._id, {$set: {
        profile: val.profile
      }});
    }
  });

  Template.CategoryRow.helpers({
    path: function () {
      return getPath(this);
    }
    , selected: function () {
      var selectedCategories = Session.get('selectedCategories');
      return selectedCategories && _.contains(selectedCategories, this._id);
    }
    , current: function () {
      var selectedCategories = Session.get('selectedCategories');
      return selectedCategories && _.last(selectedCategories) == this._id;
    }
    , timeSpans: function () {
      return getHours(this._id);
    }
    , padding: function () {
      return (getPath(this).length * 13) + 'px';
    }
  });
}
