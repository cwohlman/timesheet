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
      return !!currentTimeEntry();
    }
  });

  Template.clockoutButton.events({
    'click .btn-clockOut': function () {
      clockOut();
    }
    , 'click .btn-clockIn': function () {
      clockIn();
    }
  });

  Template.editButton.events({
    'click .btn-edit-categories': function () {
      Session.set('editing', !Session.get('editing'));
    }
  });

  Template.TimeSheetCategories.helpers({
    user: function () {
      return Meteor.user();
    }
    , categoryRows: function () {
      var selectedCategories = Session.get('selectedCategories');
      var categories = this.field('profile').field('categories');

      var results = [];

      _.find(selectedCategories, function (id) {
        results.push(categories);
        var cat = _.find(categories.children(), function (cat) {
          return (cat.value._id == id);
        });
        if (!cat) return true;
        else {
          categories = cat.field('categories');
        }
      });

      results.push(categories);

      return results;
    }
    , autosave: function () {
      var val = this.get();
      if(val) Users.update(val._id, {$set: {
        profile: val.profile
      }});
    }
  });

  Template.categoryRow.events({
    'click .btn-add-category': function () {
      var val = this.value || [];
      var name = prompt('Category Name');
      if (name) {
        val.push({
          _id: Random.id()
          , name: name
          , categories: []
        });
        this.set(val);
      }
    }
  });

  var getPath = function (parent) {
      var path = [];
      while (parent) {
        if (!parent.parent || parent.name != 'categories') break;
        if (!isNaN(parent.index)) {
          path.unshift(parent.value._id);
        }
        parent = parent.parent;
      }
      return  path;
  };

  Template.categoryButton.helpers({
    clockedIn: function () {
      var currentJob = TimeEntries.findOne({
        _finished: {
          $exists: false
        }
      });
      var selectedCategories = currentJob && currentJob.categories;
      return selectedCategories && _.contains(selectedCategories, this.value._id);
    }
    , selected: function () {
      var selectedCategories = Session.get('selectedCategories');
      return selectedCategories && _.contains(selectedCategories, this.value._id);
    }
  });

  Template.categoryButton.events({
    'click .btn-category': function () {
      Session.set('selectedCategories', getPath(this));
    }
    , 'click .btn-edit-category': function (e, tmpl) {
      e.stopPropagation();
      var newName = prompt('New Name');
      if (newName) this.field('name').set(newName);
    }
    , 'click .btn-clockIn': function (e, tmpl) {
      // e.stopPropagation();
      if (Template.categoryButton.clockedIn.apply(this)) {
        clockOut();
      } else {
        var path = getPath(this);
        clockIn(path);
      }
    }
    , 'click .btn-show-timesheet': function (e, tmpl) {
      e.stopPropagation();
      Session.set('reportCategory', this.value._id);
      $('.modal').modal();
    }
    , 'click .btn-remove-category': function (e, tmpl) {
      e.stopPropagation();
      if (confirm('remove category?')) {
        var val = this.parent.get();
        var id = this.value._id;
        val = _.filter(val, function (a) {return a._id != id;});
        this.parent.set(val);
        Session.set('selectedCategories', getPath(this.parent));        
      }
    }
  });

  Template.ReportModal.helpers({
    schema: {
      name: 'report options'
      , schema: {
        start: {
          type: 'date'
          , rules: []
        }
        , end: {
          type: 'date'
          , rules: []
        }
      }
    }
    , item: {}
    , stats: function () {

      var hasStart = !!this.field('start').value;

      var start = moment(this.field('start').value || new Date(0));
      var end = moment(this.field('end').value || new Date()).endOf('day');

      var query = {};
      var category = Session.get('reportCategory');
      if (category) {
        query.categories = category;
      }

      var entries = TimeEntries.find(query).fetch();

      // the end of the fifteenth
      var theFifteenth = end.clone().startOf('month').add(16, 'days');

      var processTimeSpan = function (a) {
        var time = _.reduce(entries, function (memo, entry) {
          if (!entry.start || !entry.end) return memo;
          var start = moment(entry.start).min(a.start).max(a.end);
          var end = moment(entry.end).min(a.start).max(a.end);
          return memo + end - start;
        }, 0);

        if (!time) {
          a.time = "none";
        } else if (a.average) {
          a.time = moment.duration(time / start.diff(end, a.average, true)).humanize();
        } else {
          a.time = moment.duration(time).humanize();
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
    }
  });

  UI.registerHelper('editing', function () {
    return Session.get('editing');
  });

  // ---------

  Template.form.form = function () {
    return new Form(this.schema || {}, this.value);
  };

  var inputHelpers = {

  };

  var inputEvents = {
    'change input': function (e, tmpl) {
      this.set(e.currentTarget.value);
    }
  };

  Template.dateInput.events(inputEvents);
  Template.textInput.events(inputEvents);

  // ---------

  Template.UserProfile.helpers({
    profileForm: function () {
      return new Form({}, Meteor.user());
    }
  });
  Template.UserProfile.events({
    'submit form': function (e, tmpl) {
      e.preventDefault();
      // return console.log(this.changes);
      Users.update(this.value._id, {$set: this.value}, function (error) {
        if (error) {
          alert(error);
        }
      });
    }
  });
  Template.TextInput.events({
    'change input': function (e, tmpl) {
      this.set(e.currentTarget.value);
    }
  });
} else {
  X = new Meteor.Collection('others');
  X.allow({
    update: function () {
      return false;
    }
  });
}
