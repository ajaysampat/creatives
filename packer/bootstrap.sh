#!/bin/bash -xv

# this prevents sudo 'unable to resolve host' complaints 
HOSTNAME=`curl -s http://169.254.169.254/latest/meta-data/hostname | cut -d '.' -f1`
echo "127.0.0.1 $HOSTNAME" | sudo tee -a /etc/hosts > /dev/null 2>&1

# Update APT
echo "Running APT update..."
sudo apt-get update

# Upgrade installed packages
echo "Running APT upgrade..."
sudo DEBIAN_FRONTEND=noninteractive apt-get -y dist-upgrade

# Install additional required packages
echo "Installing packages..."
PACKAGES="apache2 g++ apache2-dev libopkele-dev sudo nodejs libfontconfig git python-pip python-dev build-essential gdebi"
sudo DEBIAN_FRONTEND=noninteractive apt-get -y install ${PACKAGES}

echo "Installing AWS CLI..."
sudo pip install awscli

# Install CodeDeploy agent 
# Had some trouble with IAM permissions, so 
# working around by pre-installing the debian package
echo "Installing AWS CodeDeploy agent..."
wget https://s3-us-west-2.amazonaws.com/aws-codedeploy-us-west-2/latest/codedeploy-agent_all.deb
sudo /usr/bin/gdebi -n -o Dpkg::Options::=--force-confdef -o Dpg::Options::=--force-confold codedeploy-agent_all.deb

echo "Installing rc.local and firstboot..."
sudo cp /tmp/packer/etc/rc.local /etc/rc.local
sudo cp /tmp/packer/usr/local/bin/firstboot /usr/local/bin/firstboot
sudo chmod a+x /etc/rc.local
sudo chmod a+x /usr/local/bin/firstboot

# Configure central logging
echo "Installing rsyslog config..."
sudo mv /tmp/packer/etc/rsyslog.d/10-kixeye.conf /etc/rsyslog.d/10-kixeye.conf

# See http://www.rsyslog.com/doc/v7-stable/configuration/action/rsconf1_repeatedmsgreduction.html
echo "Turning rsyslog repeated message reduction off..."
sudo sed -i 's/$RepeatedMsgReduction on/$RepeatedMsgReduction off/g' /etc/rsyslog.conf

# Install openid module
echo "Installing OpenID module..."
cd /tmp/packer
tar xzf mod_auth_openid-0.8.tar.gz 
cd mod_auth_openid-0.8/
./configure
make
sudo make install

# Install latest version of npm
cd ~
echo "Installing latest version of npm..."
sudo ln -s /usr/bin/nodejs /usr/bin/node
curl -L https://www.npmjs.com/install.sh | sudo sh

echo "Installing Apache config..."
sudo cp -Rv /tmp/packer/etc/apache2/* /etc/apache2/

sudo a2enmod authopenid
sudo a2enmod auth_openidc
sudo a2enmod autoindex
sudo a2enmod cgi
sudo a2enmod dir
sudo a2enmod env
sudo a2enmod mime
sudo a2enmod negotiation
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod reqtimeout
sudo a2enmod rewrite
sudo a2enmod setenvif
sudo a2enmod socache_shmcb
sudo a2enmod status

sudo ln -sf /etc/apache2/sites-available/000-default.conf /etc/apache2/sites-enabled/000-default 

echo "Installing websites..."
sudo cp -Rv /tmp/packer/var/www /var/

echo "Installing javascript library..."
sudo cp -Rv /tmp/packer/usr/share/javascript /usr/share/
sudo mv /tmp/packer/etc/javascript-common /etc/
sudo ln -s /etc/javascript-common/javascript-common.conf /etc/apache2/conf.d/javascript-common.conf

echo "Installing creatives init script..."
sudo cp -v /tmp/packer/etc/init.d/creatives /etc/init.d/creatives
sudo chmod a+x /etc/init.d/creatives

echo "Start creatives service on boot..."
sudo update-rc.d creatives defaults

echo "Installing node modules..."
cd /usr/lib/node_modules
sudo npm install -g forever-monitor
sudo npm install -g forever
cd /var/www/node
sudo npm install

echo "Removing build instance name from hosts file..."
sudo sed -i "s/.*$HOSTNAME.*//g" /etc/hosts

echo "Done"
