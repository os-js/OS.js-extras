# Setup

Make sure you cloned this repository with submodules!

Then:
```
# Install system deps
sudo apt-get install python-twisted python-openssl make openjdk-6-jre

# Build and install deps
cd Chat/vendor/punjab
python setup.py build
sudo python setup.py install

# If you use apache as frontend, you'll need to enable the proxy module
sudo a2enmod proxy_http
sudo service apache2 restart

# Start service
sudo twistd punjab
```

# Notes

Connect with your Google Mail account.

You have to enable "Allow less secure apps" in your Account Settings to allow authentication.

https://myaccount.google.com/security?pli=1
